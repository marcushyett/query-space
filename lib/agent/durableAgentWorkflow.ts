import { prisma } from '@/lib/db/prisma';
import { streamQueryAgent } from './queryAgent';
import type { SchemaInfo } from './tools';

// Status constants matching Prisma enum
const AgentStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

export interface DurableAgentConfig {
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
 * Update session status in database.
 * Marked as a step for durability and automatic retries.
 */
async function updateSessionStatus(sessionId: string, status: string) {
  'use step';
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { status },
  });
}

/**
 * Check if the session has been signaled to stop.
 * Returns true if the session status is PAUSED (user requested stop).
 */
async function shouldStopSession(sessionId: string): Promise<boolean> {
  'use step';
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    select: { status: true },
  });
  return session?.status === 'PAUSED';
}

/**
 * Store an agent event in the database.
 * Marked as a step for durability and automatic retries.
 */
async function storeAgentEvent(
  sessionId: string,
  sequenceNumber: number,
  eventType: string,
  eventData: Record<string, unknown>
) {
  'use step';
  await prisma.agentEvent.create({
    data: {
      sessionId,
      sequenceNumber,
      eventType,
      eventData,
    },
  });
}

/**
 * Update session state based on tool call result.
 * Marked as a step for durability and automatic retries.
 */
async function handleToolCallResult(
  sessionId: string,
  toolName: string,
  args: Record<string, unknown>,
  result: unknown
) {
  'use step';

  // Update currentSql and add assistant message to chatHistory if this is update_query_ui
  if (toolName === 'update_query_ui') {
    const typedArgs = args as { sql?: string; explanation?: string; summary?: string };
    if (typedArgs.sql) {
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
          currentSql: typedArgs.sql,
          chatHistory: [
            ...existingHistory,
            {
              role: 'assistant',
              content: typedArgs.explanation || 'Here is the generated query:',
              timestamp: Date.now(),
              sql: typedArgs.sql,
              explanation: typedArgs.explanation,
              summary: typedArgs.summary,
            },
          ],
        },
      });
    }
  }

  // Update queryName if this is set_query_name
  if (toolName === 'set_query_name') {
    const typedResult = result as { name?: string };
    if (typedResult.name) {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { queryName: typedResult.name },
      });
    }
  }

  // Track errors from execute_query
  if (toolName === 'execute_query') {
    const typedResult = result as { success: boolean; error?: string };
    if (!typedResult.success && typedResult.error) {
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
          lastError: typedResult.error,
          chatHistory: [
            ...existingHistory,
            {
              role: 'system',
              content: `Query error: ${typedResult.error}`,
              timestamp: Date.now(),
            },
          ],
        },
      });
    }
  }

  // Track todos
  if (toolName === 'manage_todo') {
    const typedResult = result as {
      success: boolean;
      action: string;
      items?: { id: string; text: string; status: string }[];
    };
    if (typedResult.success && typedResult.action === 'create' && typedResult.items) {
      await prisma.agentSession.update({
        where: { id: sessionId },
        data: { todos: typedResult.items },
      });
    }
  }
}

/**
 * Update session step count.
 * Marked as a step for durability.
 */
async function updateSessionStep(sessionId: string, step: number) {
  'use step';
  await prisma.agentSession.update({
    where: { id: sessionId },
    data: { currentStep: step },
  });
}

/**
 * Finalize session with completion status.
 * Marked as a step for durability.
 */
async function finalizeSession(
  sessionId: string,
  stopReason: string | null,
  currentSql: string | null,
  lastError: string | null,
  todos: { id: string; text: string; status: string }[],
  hasIncompleteTodos: boolean
) {
  'use step';

  let finalStatus: string = AgentStatus.COMPLETED;
  if (stopReason === 'timeout' || stopReason === 'step_limit') {
    finalStatus = AgentStatus.PAUSED;
  } else if (stopReason === 'error') {
    finalStatus = AgentStatus.FAILED;
  } else if (hasIncompleteTodos) {
    finalStatus = AgentStatus.PAUSED;
  }

  await prisma.agentSession.update({
    where: { id: sessionId },
    data: {
      status: finalStatus,
      currentSql,
      lastError,
      todos: todos.length > 0 ? todos : undefined,
    },
  });
}

/**
 * Mark session as failed with error.
 * Marked as a step for durability.
 */
async function markSessionFailed(sessionId: string, errorMessage: string, sequenceNumber: number) {
  'use step';

  // Store error event
  await prisma.agentEvent.create({
    data: {
      sessionId,
      sequenceNumber,
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

/**
 * Durable agent workflow that runs the AI agent.
 *
 * This workflow uses the "use workflow" directive to make it durable:
 * - It survives serverless function restarts
 * - It can resume from where it left off if interrupted
 * - It persists state automatically
 * - It can run for longer than the standard serverless timeout
 *
 * The workflow will continue running even if the client disconnects.
 */
export async function runDurableAgent(config: DurableAgentConfig): Promise<{ success: boolean; sessionId: string }> {
  'use workflow';

  const { sessionId, connectionString, schema, prompt, previousSql, previousContext, model } = config;

  // Update session status to RUNNING
  await updateSessionStatus(sessionId, AgentStatus.RUNNING);

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
      }
    );

    for await (const event of agentStream) {
      // Check if session has been signaled to stop (user requested stop)
      const shouldStop = await shouldStopSession(sessionId);
      if (shouldStop) {
        // Store a final event indicating the session was stopped by user
        await storeAgentEvent(
          sessionId,
          sequenceNumber++,
          'stopped',
          { type: 'stopped', reason: 'user_requested' }
        );
        return { success: true, sessionId };
      }

      // Store the event in the database
      await storeAgentEvent(
        sessionId,
        sequenceNumber++,
        event.type,
        event as unknown as Record<string, unknown>
      );

      // Update session state based on event type
      if (event.type === 'step') {
        await updateSessionStep(sessionId, event.step);
      } else if (event.type === 'tool_call_result') {
        const tc = event.toolCall;
        await handleToolCallResult(
          sessionId,
          tc.toolName,
          tc.args,
          tc.result
        );
      } else if (event.type === 'complete') {
        const state = event.state;
        await finalizeSession(
          sessionId,
          state.stopReason,
          state.currentSql,
          state.lastError,
          state.todos,
          state.hasIncompleteTodos
        );
      } else if (event.type === 'error') {
        await prisma.agentSession.update({
          where: { id: sessionId },
          data: { lastError: event.error },
        });
      }
    }

    return { success: true, sessionId };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Store error and mark session as failed
    await markSessionFailed(sessionId, errorMessage, sequenceNumber);

    return { success: false, sessionId };
  }
}
