import { generateText } from 'ai';
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyMessage = any;

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

  const messages: AnyMessage[] = [
    { role: 'user', content: userContent },
  ];

  const model = anthropic('claude-haiku-4-5-20251001');

  // Agent loop - run until goal is completed or max steps reached
  while (state.currentStep < state.maxSteps && !state.hasCompletedGoal) {
    if (signal?.aborted) {
      break;
    }

    state.currentStep++;
    yield { type: 'step', step: state.currentStep, maxSteps: state.maxSteps };

    try {
      // DEBUG: Log messages being sent to generateText
      console.log('[Agent Debug] Sending messages to generateText:', JSON.stringify(messages, null, 2));

      // Use stopWhen to control when to stop the agent loop
      const result = await generateText({
        model,
        system: buildSystemPrompt(state.goal),
        messages,
        tools,
        abortSignal: signal,
        // Stop after each tool call for fine-grained control
        stopWhen: () => true,
      });

      // DEBUG: Log the result structure to understand the schema
      console.log('[Agent Debug] Step', state.currentStep);
      console.log('[Agent Debug] Current messages:', JSON.stringify(messages, null, 2));
      console.log('[Agent Debug] result.toolCalls:', JSON.stringify(result.toolCalls, null, 2));
      console.log('[Agent Debug] result.toolResults:', JSON.stringify(result.toolResults, null, 2));
      console.log('[Agent Debug] result.response?.messages:', JSON.stringify(result.response?.messages, null, 2));

      // Emit text if any
      if (result.text) {
        yield { type: 'text', text: result.text };
      }

      // Process tool calls from all steps
      for (const step of result.steps) {
        if (step.toolCalls && step.toolCalls.length > 0) {
          for (const toolCall of step.toolCalls) {
            const tc = toolCall as AnyMessage;
            const record: ToolCallRecord = {
              id: toolCall.toolCallId,
              toolName: toolCall.toolName,
              args: (tc.input ?? tc.args ?? {}) as Record<string, unknown>,
              result: null,
              timestamp: Date.now(),
            };

            yield { type: 'tool_call_start', toolName: toolCall.toolName, args: record.args };

            // Find the corresponding result (SDK v6 uses 'output', fallback to 'result')
            const toolResult = step.toolResults?.find((r: AnyMessage) => r.toolCallId === toolCall.toolCallId) as AnyMessage | undefined;
            if (toolResult) {
              record.result = toolResult.output ?? toolResult.result ?? null;
            }

            // Handle special update_query_ui tool (SDK v6 uses 'input', fallback to 'args')
            if (toolCall.toolName === 'update_query_ui') {
              const toolInput = (tc.input ?? tc.args ?? {}) as { sql: string; explanation: string };
              state.currentSql = formatSql(toolInput.sql);
              state.hasCompletedGoal = true;
            }

            // Track errors from execute_query
            if (toolCall.toolName === 'execute_query' && record.result) {
              const execResult = record.result as { success: boolean; error?: string };
              if (!execResult.success && execResult.error) {
                state.lastError = execResult.error;
              } else {
                state.lastError = null;
              }
            }

            state.toolCalls.push(record);
            yield { type: 'tool_call_result', toolCall: record };
          }
        }
      }

      // Build messages for next iteration
      // We need to manually construct messages because SDK's response.messages
      // wraps output in {type: "json", value: ...} which doesn't work for generateText input
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant',
          content: result.toolCalls.map((tc: AnyMessage) => ({
            type: 'tool-call',
            toolCallId: tc.toolCallId,
            toolName: tc.toolName,
            args: tc.args ?? {},
          })),
        });

        // Add tool results message
        if (result.toolResults && result.toolResults.length > 0) {
          messages.push({
            role: 'tool',
            content: result.toolResults.map((tr: AnyMessage) => ({
              type: 'tool-result',
              toolCallId: tr.toolCallId,
              // Unwrap the result - SDK may wrap in {type: "json", value: ...}
              result: tr.result?.value ?? tr.result ?? null,
            })),
          });
        }

        console.log('[Agent Debug] Built messages manually');
      } else if (result.text) {
        messages.push({ role: 'assistant', content: result.text });
      }

      // If model stopped without calling update_query_ui, prompt it
      if (result.finishReason === 'stop' && !state.hasCompletedGoal && result.text) {
        messages.push({
          role: 'user',
          content: 'Please use the update_query_ui tool to finalize your query for the user to review.',
        });
      }

      // Check if done
      if (result.finishReason === 'stop' && state.hasCompletedGoal) {
        break;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      state.lastError = errorMessage;

      // If aborted, break out
      if (signal?.aborted || errorMessage.includes('aborted')) {
        break;
      }

      yield { type: 'error', error: errorMessage };

      // Add error context and continue
      messages.push({
        role: 'user',
        content: `An error occurred: ${errorMessage}. Please continue and try a different approach.`,
      });
    }
  }

  // Check if we hit the step limit
  if (state.currentStep >= state.maxSteps && !state.hasCompletedGoal) {
    state.reachedStepLimit = true;
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
