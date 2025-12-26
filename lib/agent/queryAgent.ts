import { streamText, stepCountIs, hasToolCall } from 'ai';
import { anthropic } from '@ai-sdk/anthropic';
import { createQueryAgentTools, SchemaInfo } from './tools';
import { formatSql } from '@/lib/sql-formatter';

export const MAX_AGENT_STEPS = 25;

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

function buildSystemPrompt(goal: string): string {
  return `You are an expert PostgreSQL query builder agent. Your goal is to help users create SQL queries that exactly match their requirements.

## YOUR MISSION
The user wants: "${goal}"

You must create a query that satisfies this goal. Keep working until you have a query that returns the expected data.

## AVAILABLE TOOLS
You have these tools to help you:

1. **get_table_schema** - Get complete database schema with tables and columns. Use this first!
2. **get_json_keys** - Explore JSON/JSONB column structures to find the right field names
3. **execute_query** - Run SELECT queries to test your results. Use this to verify your query works!
4. **validate_query** - Check if a query is syntactically valid PostgreSQL
5. **update_query_ui** - REQUIRED: Call this when you have a final query for the user

## WORKFLOW
1. First, understand the database structure with get_table_schema
2. If the user's request involves JSON fields, use get_json_keys to explore the structure
3. Write an initial query and test it with execute_query
4. If the query returns unexpected results (empty, wrong columns, etc.), iterate:
   - Analyze what went wrong
   - Use get_json_keys to find correct field names
   - Try alternative approaches
   - Test again with execute_query
5. When satisfied, call update_query_ui with the final query

## CRITICAL RULES
- ONLY generate SELECT queries. Never INSERT, UPDATE, DELETE, or DROP.
- Always wrap table and column names in double quotes
- Always test your query with execute_query before finalizing
- If execute_query returns all NULL for a column, the field name is probably wrong
- When JSON fields return NULL, use get_json_keys to find the actual field names
- If a query returns 0 rows, investigate why - don't just give up
- Call update_query_ui when you have a working query that meets the goal

## SQL FORMATTING
Format your SQL with proper line breaks:
- Each major clause (SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, LIMIT) on its own line
- AND/OR conditions on separate lines with indentation

## GOAL VALIDATION
Before calling update_query_ui, verify:
1. The query executes successfully (test with execute_query)
2. The results contain the data the user asked for
3. No columns are unexpectedly NULL (unless expected)
4. Row count seems reasonable for the request

If you cannot achieve the goal after multiple attempts, call update_query_ui with your best attempt and explain what you tried.`;
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
    // Use Vercel AI SDK's native agent loop with streamText
    // stopWhen conditions: stop when update_query_ui is called OR max steps reached
    const result = streamText({
      model,
      system: buildSystemPrompt(state.goal),
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
