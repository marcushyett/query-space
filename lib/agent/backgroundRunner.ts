import { PrismaClient, AgentSessionStatus } from '@prisma/client';
import { streamQueryAgent, type SchemaInfo } from './queryAgent';

// Use a singleton Prisma client for the background runner
const prisma = new PrismaClient();

// Track running agents by session ID
const runningAgents = new Map<string, AbortController>();

export interface BackgroundAgentConfig {
  sessionId: string;
  organizationId: string;
  prompt: string;
  connectionString: string;
  schema: SchemaInfo[];
  previousSql?: string;
  previousContext?: string;
}

/**
 * Start an agent running in the background.
 * The agent will continue running even if the HTTP connection is closed.
 * All events are persisted to the database for later retrieval.
 */
export async function startBackgroundAgent(config: BackgroundAgentConfig): Promise<void> {
  const { sessionId, connectionString, schema, prompt, previousSql, previousContext } = config;

  // Create abort controller for this agent
  const abortController = new AbortController();
  runningAgents.set(sessionId, abortController);

  // Update session status to RUNNING
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status: AgentSessionStatus.RUNNING },
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

        // Update currentSql if this is update_query_ui
        if (tc.toolName === 'update_query_ui') {
          const args = tc.args as { sql?: string };
          if (args.sql) {
            await prisma.agentSession.update({
              where: { id: sessionId },
              data: { currentSql: args.sql },
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

        // Track errors
        if (tc.toolName === 'execute_query') {
          const result = tc.result as { success: boolean; error?: string };
          if (!result.success && result.error) {
            await prisma.agentSession.update({
              where: { id: sessionId },
              data: { lastError: result.error },
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
      } else if (event.type === 'text') {
        // Accumulate streaming text
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: {
            lastStreamingText: {
              // Append to existing text (Prisma doesn't support this directly, so we do a workaround)
              set: undefined,
            },
          },
        });
        // For text streaming, we just store the event - the client can reconstruct
      } else if (event.type === 'complete') {
        const state = event.state;

        let finalStatus: AgentSessionStatus = AgentSessionStatus.COMPLETED;
        if (state.stopReason === 'timeout' || state.stopReason === 'step_limit') {
          finalStatus = AgentSessionStatus.PAUSED;
        } else if (state.stopReason === 'error') {
          finalStatus = AgentSessionStatus.FAILED;
        } else if (state.hasIncompleteTodos) {
          finalStatus = AgentSessionStatus.PAUSED;
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
          status: AgentSessionStatus.FAILED,
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
