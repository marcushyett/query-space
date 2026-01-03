import { prisma } from '@/lib/db/prisma';
import { streamQueryAgent } from './queryAgent';
import type { SchemaInfo } from './tools';

// Track running agents by session ID
const runningAgents = new Map<string, AbortController>();

// Status constants matching Prisma enum
const AgentStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export interface BackgroundAgentConfig {
  sessionId: string;
  organizationId: string;
  prompt: string;
  connectionString: string;
  schema: SchemaInfo[];
  previousSql?: string;
  previousContext?: string;
  model?: string;
}

/**
 * Start an agent running in the background.
 * The agent will continue running even if the HTTP connection is closed.
 * All events are persisted to the database for later retrieval.
 */
export async function startBackgroundAgent(config: BackgroundAgentConfig): Promise<void> {
  const { sessionId, connectionString, schema, prompt, previousSql, previousContext, model } = config;

  // Create abort controller for this agent
  const abortController = new AbortController();
  runningAgents.set(sessionId, abortController);

  // Update session status to RUNNING
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: AgentStatus.RUNNING },
  });

  let sequenceNumber = 0;

  try {
    const agentStream = streamQueryAgent(
      prompt,
      {
        connectionString,
        schema,
        previousSql,
        previousContext,
        model,
      },
      abortController.signal
    );

    for await (const event of agentStream) {
      if (abortController.signal.aborted) {
        break;
      }

      // Store the event in the database
      await prisma.agentEvent.create({
        data: {
          sessionId,
          sequenceNumber: sequenceNumber++,
          eventType: event.type,
          eventData: event as unknown as Record<string, unknown>,
        },
      });

      // Update session state based on event type
      if (event.type === 'step') {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { currentStep: event.step },
        });
      } else if (event.type === 'tool_call_result') {
        const tc = event.toolCall;

        // Update currentSql and add assistant message to chatHistory if this is update_query_ui
        if (tc.toolName === 'update_query_ui') {
          const args = tc.args as { sql?: string; explanation?: string; summary?: string };
          if (args.sql) {
            // Get current session to append to chatHistory
            const currentSession = await prisma.agentSession.findUnique({
              where: { id: sessionId },
              select: { chatHistory: true },
            });

            const existingHistory = (currentSession?.chatHistory as Array<{
              role: string;
              content: string;
              timestamp: number;
              sql?: string;
              explanation?: string;
              summary?: string;
            }>) || [];

            await prisma.agentSession.update({
              where: { id: sessionId },
              data: {
                currentSql: args.sql,
                chatHistory: [
                  ...existingHistory,
                  {
                    role: 'assistant',
                    content: args.explanation || 'Here is the generated query:',
                    timestamp: Date.now(),
                    sql: args.sql,
                    explanation: args.explanation,
                    summary: args.summary,
                  },
                ],
              },
            });
          }
        }

        // Update queryName if this is set_query_name
        if (tc.toolName === 'set_query_name') {
          const result = tc.result as { name?: string };
          if (result.name) {
            await prisma.agentSession.update({
              where: { id: sessionId },
              data: { queryName: result.name },
            });
          }
        }

        // Track errors and add to chatHistory
        if (tc.toolName === 'execute_query') {
          const result = tc.result as { success: boolean; error?: string };
          if (!result.success && result.error) {
            // Get current session to append error to chatHistory
            const currentSession = await prisma.agentSession.findUnique({
              where: { id: sessionId },
              select: { chatHistory: true },
            });

            const existingHistory = (currentSession?.chatHistory as Array<{
              role: string;
              content: string;
              timestamp: number;
            }>) || [];

            await prisma.agentSession.update({
              where: { id: sessionId },
              data: {
                lastError: result.error,
                chatHistory: [
                  ...existingHistory,
                  {
                    role: 'system',
                    content: `Query error: ${result.error}`,
                    timestamp: Date.now(),
                  },
                ],
              },
            });
          }
        }

        // Track todos
        if (tc.toolName === 'manage_todo') {
          const result = tc.result as {
            success: boolean;
            action: string;
            items?: { id: string; text: string; status: string }[];
          };
          if (result.success && result.action === 'create' && result.items) {
            await prisma.agentSession.update({
              where: { id: sessionId },
              data: { todos: result.items },
            });
          }
        }
      } else if (event.type === 'complete') {
        const state = event.state;

        let finalStatus: string = AgentStatus.COMPLETED;
        if (state.stopReason === 'timeout' || state.stopReason === 'step_limit') {
          finalStatus = AgentStatus.PAUSED;
        } else if (state.stopReason === 'error') {
          finalStatus = AgentStatus.FAILED;
        } else if (state.hasIncompleteTodos) {
          finalStatus = AgentStatus.PAUSED;
        }

        await prisma.agentSession.update({
          where: { id: sessionId },
          data: {
            status: finalStatus,
            currentSql: state.currentSql,
            lastError: state.lastError,
            todos: state.todos.length > 0 ? state.todos : undefined,
          },
        });
      } else if (event.type === 'error') {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { lastError: event.error },
        });
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Don't update status if aborted (that's intentional)
    if (!abortController.signal.aborted && !errorMessage.includes('aborted')) {
      // Store error event
      await prisma.agentEvent.create({
        data: {
          sessionId,
          sequenceNumber: sequenceNumber++,
          eventType: 'error',
          eventData: { type: 'error', error: errorMessage },
        },
      });

      await prisma.agentSession.update({
        where: { id: sessionId },
        data: {
          status: AgentStatus.FAILED,
          lastError: errorMessage,
        },
      });
    }
  } finally {
    runningAgents.delete(sessionId);
  }
}

/**
 * Stop a running background agent.
 */
export function stopBackgroundAgent(sessionId: string): boolean {
  const controller = runningAgents.get(sessionId);
  if (controller) {
    controller.abort();
    runningAgents.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Check if an agent is currently running.
 */
export function isAgentRunning(sessionId: string): boolean {
  return runningAgents.has(sessionId);
}

/**
 * Get all currently running agent session IDs.
 */
export function getRunningAgentIds(): string[] {
  return Array.from(runningAgents.keys());
}
