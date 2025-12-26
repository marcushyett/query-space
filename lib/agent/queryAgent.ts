import { streamText, stepCountIs, hasToolCall } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createQueryAgentTools, SchemaInfo } from './tools';
import { formatSql } from '@/lib/sql-formatter';

export const MAX_AGENT_STEPS = 15;

export interface AgentState {
  goal: string;
  currentStep: number;
  maxSteps: number;
  hasCompletedGoal: boolean;
  currentSql: string | null;
  previousSql: string | null;
  lastError: string | null;
  toolCalls: ToolCallRecord[];
  reachedStepLimit: boolean;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  args: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

export interface AgentConfig {
  connectionString: string;
  schema: SchemaInfo[];
  previousSql?: string;
}

function buildSystemPrompt(goal: string, isFollowUp: boolean): string {
  return `You are an expert PostgreSQL query builder. Help users create and refine SQL queries.

## YOUR TASK
${isFollowUp ? `The user is providing feedback on a previous query: "${goal}"

IMPORTANT: This is a follow-up request. The user wants you to modify or improve the existing query based on their feedback. Acknowledge their request and explain what changes you'll make.` : `Create a query for: "${goal}"`}

## COMMUNICATION STYLE
- Be concise and clear in your explanations
- When modifying a query, briefly explain what you're changing and why
- Use plain text - avoid markdown formatting like **bold** or \`code\`
- Keep explanations short (1-2 sentences per point)

## TOOLS
1. get_table_schema - Get database structure (use first if needed)
2. get_json_keys - Explore JSON column structure
3. execute_query - Test queries (use sparingly - only when needed)
4. validate_query - Check syntax without running
5. update_query_ui - Finalize and present query to user

## EFFICIENCY GUIDELINES
- Only call get_table_schema if you don't already know the schema
- Don't call execute_query multiple times with the same query
- For simple modifications, validate_query is often enough
- Aim to complete in 3-5 tool calls when possible

## RULES
- Only SELECT queries allowed
- Quote table/column names with double quotes
- Test complex queries before finalizing
- If columns return NULL, check field names with get_json_keys

## FINISHING
Call update_query_ui with:
- The final SQL query
- A brief explanation of what it does${isFollowUp ? '\n- What you changed from the previous query' : ''}`;
}

export type AgentStreamEvent =
  | { type: 'step'; step: number; maxSteps: number }
  | { type: 'text'; text: string }
  | { type: 'tool_call_start'; toolName: string; args: Record<string, unknown> }
  | { type: 'tool_call_result'; toolCall: ToolCallRecord }
  | { type: 'error'; error: string }
  | { type: 'complete'; state: AgentState };

/**
 * Stream the query agent using Vercel AI SDK's native agent loop.
 * Uses streamText with stopWhen conditions to let the SDK handle the multi-step agent execution.
 */
export async function* streamQueryAgent(
  userMessage: string,
  config: AgentConfig,
  signal?: AbortSignal
): AsyncGenerator<AgentStreamEvent> {
  const state: AgentState = {
    goal: userMessage,
    currentStep: 0,
    maxSteps: MAX_AGENT_STEPS,
    hasCompletedGoal: false,
    currentSql: config.previousSql || null,
    previousSql: config.previousSql || null,
    lastError: null,
    toolCalls: [],
    reachedStepLimit: false,
  };

  // Create tools with context
  const tools = createQueryAgentTools({
    connectionString: config.connectionString,
    schema: config.schema,
  });

  // Build initial message
  const userContent = config.previousSql
    ? `Current SQL query:\n\`\`\`sql\n${config.previousSql}\n\`\`\`\n\nUser request: ${userMessage}`
    : userMessage;

  const model = anthropic('claude-haiku-4-5-20251001');

  try {
    // Detect if this is a follow-up (has previous SQL context)
    const isFollowUp = !!config.previousSql;

    // Use Vercel AI SDK's native agent loop with streamText
    // stopWhen conditions: stop when update_query_ui is called OR max steps reached
    const result = streamText({
      model,
      system: buildSystemPrompt(state.goal, isFollowUp),
      messages: [{ role: 'user', content: userContent }],
      tools,
      // Stop when the agent calls update_query_ui (goal achieved) or after max steps
      stopWhen: [
        hasToolCall('update_query_ui'),
        stepCountIs(MAX_AGENT_STEPS),
      ],
      abortSignal: signal,
    });

    // Track tool calls by ID for matching results
    const pendingToolCalls = new Map<string, ToolCallRecord>();

    // Process the full stream from the SDK
    for await (const part of result.fullStream) {
      if (signal?.aborted) {
        break;
      }

      switch (part.type) {
        case 'start-step':
          state.currentStep++;
          yield { type: 'step', step: state.currentStep, maxSteps: state.maxSteps };
          break;

        case 'text-delta':
          yield { type: 'text', text: part.text };
          break;

        case 'tool-call': {
          const record: ToolCallRecord = {
            id: part.toolCallId,
            toolName: part.toolName,
            args: (part.input ?? {}) as Record<string, unknown>,
            result: null,
            timestamp: Date.now(),
          };

          pendingToolCalls.set(part.toolCallId, record);
          yield { type: 'tool_call_start', toolName: part.toolName, args: record.args };

          // Handle update_query_ui tool call to track completion
          if (part.toolName === 'update_query_ui') {
            const input = part.input as { sql: string; explanation: string };
            if (input?.sql) {
              state.currentSql = formatSql(input.sql);
              state.hasCompletedGoal = true;
            }
          }
          break;
        }

        case 'tool-result': {
          const record = pendingToolCalls.get(part.toolCallId);

          if (record) {
            record.result = part.output;
            state.toolCalls.push(record);
            yield { type: 'tool_call_result', toolCall: record };
            pendingToolCalls.delete(part.toolCallId);

            // Track errors from execute_query
            if (record.toolName === 'execute_query' && record.result) {
              const execResult = record.result as { success: boolean; error?: string };
              if (!execResult.success && execResult.error) {
                state.lastError = execResult.error;
              } else {
                state.lastError = null;
              }
            }
          }
          break;
        }

        case 'error':
          yield { type: 'error', error: part.error instanceof Error ? part.error.message : String(part.error) };
          state.lastError = part.error instanceof Error ? part.error.message : String(part.error);
          break;

        case 'finish':
          // Check if we hit the step limit without completing
          if (state.currentStep >= MAX_AGENT_STEPS && !state.hasCompletedGoal) {
            state.reachedStepLimit = true;
          }
          break;
      }
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    state.lastError = errorMessage;

    // Don't yield error if aborted
    if (!signal?.aborted && !errorMessage.includes('aborted')) {
      yield { type: 'error', error: errorMessage };
    }
  }

  yield { type: 'complete', state };
}

// Non-streaming version for simpler use cases
export async function runQueryAgent(
  userMessage: string,
  config: AgentConfig,
  onToolCall?: (toolCall: ToolCallRecord) => void,
  onStateUpdate?: (state: Partial<AgentState>) => void,
  signal?: AbortSignal
): Promise<AgentState> {
  let finalState: AgentState | null = null;

  for await (const event of streamQueryAgent(userMessage, config, signal)) {
    switch (event.type) {
      case 'step':
        if (onStateUpdate) {
          onStateUpdate({ currentStep: event.step });
        }
        break;
      case 'tool_call_result':
        if (onToolCall) {
          onToolCall(event.toolCall);
        }
        break;
      case 'complete':
        finalState = event.state;
        break;
    }
  }

  return finalState!;
}
