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
  // New fields for improved agent transparency
  assumptions: string[];
  dataQualityNotes: string | null;
  alternativeApproaches: { approach: string; reason: string }[];
  // Todo tracking for completion detection
  todos: { id: string; text: string; status: string }[];
  hasIncompleteTodos: boolean;
  stopReason: 'goal_complete' | 'step_limit' | 'incomplete_todos' | 'error' | 'timeout' | null;
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
  previousContext?: string;  // Summary of previous work for continue functionality
  model?: string;  // Claude model ID to use
}

// Default model if none specified
const DEFAULT_MODEL = 'claude-haiku-4-5-20251001';

function buildSystemPrompt(goal: string, isFollowUp: boolean, context?: string): string {
  return `You are an expert PostgreSQL query builder. Help users create and refine SQL queries.

## YOUR TASK
${isFollowUp ? `The user is providing feedback on a previous query: "${goal}"

IMPORTANT: This is a follow-up request. The user wants you to modify or improve the existing query based on their feedback. Acknowledge their request and explain what changes you'll make.` : `Create a query for: "${goal}"`}
${context ? `\n## PREVIOUS CONTEXT\n${context}` : ''}

## COMMUNICATION STYLE
- Be concise and clear in your explanations
- When modifying a query, briefly explain what you're changing and why
- Use plain text - avoid markdown formatting like **bold** or \`code\`
- Keep explanations short (1-2 sentences per point)

## CRITICAL: SEQUENTIAL EXECUTION
- NEVER run multiple tools in parallel
- Wait for each tool result before calling the next tool
- When a tool returns successfully, use that result before trying alternatives
- If execute_query succeeds, do NOT run more queries - use that result

## CRITICAL: USE TODO LIST FOR ALL NON-TRIVIAL QUERIES
**ALWAYS use manage_todo FIRST** unless the query can be solved in a single obvious step.

Create a todo list if the query:
- Needs schema exploration (you don't know the tables/columns)
- Involves multiple tables or JOINs
- Requires aggregations or analytics (GROUP BY, window functions)
- Has multiple sub-tasks (e.g., "show me X and also Y")
- Needs JSON column exploration
- Could have multiple valid approaches
- Requires understanding the data structure first

**SKIP the todo list** for simple queries (saves time):
- Single table queries without complex logic
- Simple COUNT, SUM, AVG on one table
- Direct column selections
- Follow-up modifications to existing queries
- When you can complete the task in 2-3 tool calls

For these cases, go directly to: get_table_schema (if needed) → execute_query → update_query_ui → set_query_name

**Before doing ANYTHING else**, call manage_todo with action="create" to plan your steps.
This gives the user visibility into your progress and helps you stay organized.

Example - User asks "Show me sales by product category with growth":
1. FIRST call: manage_todo(action="create", items=["Get table schema", "Find sales and product tables", "Build aggregation query", "Add growth calculation"])
2. THEN proceed with get_table_schema, marking items complete as you go

## MULTI-APPROACH STRATEGY (IMPORTANT)
For non-trivial queries, consider multiple approaches before committing to one:

1. **Identify alternatives early** - After examining the schema, briefly consider 2-3 ways to achieve the goal
2. **Evaluate based on data** - Use quick exploratory queries to assess which approach fits the data best
3. **Choose efficiently** - Don't exhaustively test all approaches; identify the most promising one based on:
   - Data availability (which tables have the needed columns?)
   - Data quality (which columns have fewer NULLs/issues?)
   - Query simplicity (simpler is better when results are equivalent)
4. **Document your choice** - When calling update_query_ui, include alternativeApproaches to explain what else you considered

Example thought process:
- "I could join orders->products or use a denormalized sales_summary table"
- "Quick check: sales_summary has the aggregations ready, orders table would need GROUP BY"
- "sales_summary is simpler and has good data quality, using that approach"

## DATA QUALITY AWARENESS
Pay attention to data quality throughout your analysis:

1. **Check execute_query results** - Look at the dataQuality field for issues
2. **Handle problematic data**:
   - Filter NULL values when they would corrupt aggregations
   - Exclude infinite values from calculations
   - Consider using COALESCE for missing data
3. **Use analyze_data_quality** - For deeper analysis when you see warnings
4. **Document assumptions** - Always record what filtering or data handling you applied

When data quality is poor:
- Add WHERE clauses to filter bad data
- Use COALESCE, NULLIF, or CASE to handle edge cases
- Note all data handling decisions in assumptions

## STATISTICAL VALIDITY CHECK (IMPORTANT FOR PROPORTIONS)
When the query involves percentages, ratios, rankings, or "top N" results:

1. **After execute_query, use review_results** to check for:
   - Low sample sizes that make percentages misleading
   - Trivial outliers (e.g., a school with 1 student getting 100% A grades)
   - Results that don't match the "spirit" of the question

2. **If review_results detects issues:**
   - AUTOMATICALLY refine the query to add minimum sample size filters
   - Use HAVING clause: e.g., HAVING COUNT(*) >= 30
   - Re-run the query with the filter applied
   - Explain to the user: what you found, why you filtered, and the difference

3. **Example scenario:**
   User asks: "Schools with highest percentage of A-grade students"
   - Initial query might return a school with 1 student who got an A (100%)
   - review_results detects this as a trivial outlier
   - Refine with: HAVING COUNT(students) >= 30
   - Explain: "I filtered out schools with fewer than 30 students to show statistically meaningful results"

4. **Always explain refinements:**
   - What the original results showed
   - Why they were misleading
   - What filter you applied
   - How the refined results better answer the question

## ASSUMPTIONS TRACKING (REQUIRED)
You MUST track and report all assumptions made during analysis. When calling update_query_ui:

1. **Always provide assumptions array** with items like:
   - "Filtered out 15% of rows with NULL values in 'amount' column"
   - "Used 'created_at' as the date column (other option was 'updated_at')"
   - "Applied 30-day default window as no date range was specified"
   - "Assumed 'status' = 'completed' means successful transactions"
   - "Excluded test accounts (emails containing 'test')"

2. **Include dataQualityNotes** if you encountered and handled data issues

3. **List alternativeApproaches** you considered with reasons for your choice

This transparency helps users understand and trust the results.

## HANDLING AMBIGUITY AND CLARIFICATION
When facing ambiguity, follow this priority:
1. **First, try to find the answer yourself** - Use get_table_schema, execute exploratory queries, check column names
2. **Make reasonable assumptions** - If the data suggests an obvious interpretation, use it
3. **Only ask for clarification when truly necessary** - If there are multiple equally valid approaches that would produce very different results

When you DO need to ask for clarification:
- Be specific about what you need to know
- Present the options clearly (e.g., "I found two date columns: created_at and updated_at. Which should I use for the time range?")
- Explain what you've already discovered

Do NOT ask for clarification about:
- Minor formatting preferences (just pick a reasonable default)
- Things you can discover by querying the schema
- Obvious interpretations of common terms

## TOOLS
1. **manage_todo** - REQUIRED FIRST for non-trivial queries (see above)
2. get_table_schema - Get database structure including JSON column keys (use first if needed)
3. execute_query - Test queries (ALWAYS provide title and description) - includes data quality analysis
4. validate_query - Check syntax without running
5. update_query_ui - Finalize and present query to user (ALWAYS provide summary AND assumptions)
6. generate_chart - Create a visualization for query results (ALWAYS provide title and description)
7. analyze_data_quality - Deep analysis of data quality issues when needed
8. **review_results** - Check for statistical validity (use for percentage/proportion queries)
9. **set_query_name** - ALWAYS call this after update_query_ui to name the query

## TODO LIST WORKFLOW
1. Call manage_todo(action="create", items=[...]) at the START
2. Call manage_todo(action="set_current", item_id=...) before each step
3. Call manage_todo(action="complete", item_id=...) after finishing a step
4. Call manage_todo(action="add", item_text=...) if you discover new requirements

## TITLES AND DESCRIPTIONS (REQUIRED)
When calling execute_query, generate_chart, or update_query_ui, you MUST provide clear titles and descriptions:

For execute_query:
- title: Short descriptive name (e.g., "Monthly Sales by Region", "Top 10 Active Users")
- description: Brief explanation of what data this retrieves (e.g., "Retrieves total sales grouped by region for the last 30 days")

For generate_chart:
- title: Chart title (e.g., "Revenue Trend Over Time", "User Distribution by Country")
- description: What insight the visualization shows (e.g., "Shows steady growth in monthly revenue with a spike in December")

For update_query_ui:
- summary: Key findings from your analysis (e.g., "Found 1,234 active users in the last week, with most activity from mobile devices. The query groups users by device type and shows their last activity timestamp.")

## POSTGRESQL SYNTAX RULES (CRITICAL - follow exactly)
1. ALWAYS quote identifiers with double quotes: "table_name", "column_name"
2. String literals use single quotes: 'value'
3. For JSON/JSONB access:
   - Use -> for JSON object: "column"->'key'
   - Use ->> for text extraction: "column"->>'key'
   - Use #> for path: "column"#>'{path,to,key}'
   - Use #>> for path as text: "column"#>>'{path,to,key}'
   - Cast when needed: ("column"->>'number')::integer
4. Array syntax: ARRAY['a','b'] or '{a,b}'::text[]
5. Date/time: Use INTERVAL '1 day', DATE 'YYYY-MM-DD', TIMESTAMP 'YYYY-MM-DD HH:MI:SS'
6. Boolean: Use true/false (lowercase, no quotes)
7. NULL checks: Use IS NULL or IS NOT NULL (never = NULL)
8. LIMIT goes at the end, after ORDER BY
9. GROUP BY must include all non-aggregated SELECT columns
10. For case-insensitive search: use ILIKE or LOWER("column")

## COMMON MISTAKES TO AVOID
- Don't use backticks \` for identifiers - use double quotes "
- Don't use TOP N - use LIMIT N
- Don't use + for string concat - use || or CONCAT()
- Don't use GETDATE() - use NOW() or CURRENT_TIMESTAMP
- Don't use LEN() - use LENGTH() or CHAR_LENGTH()
- Don't use ISNULL() - use COALESCE()
- Don't forget to cast JSONB text to proper types for comparisons

## EFFICIENCY GUIDELINES (CRITICAL - FOLLOW STRICTLY)
- Only call get_table_schema ONCE at the start if needed - never repeat it
- Skip the todo list for simple queries (single table, no complex joins/aggregations)
- Don't call execute_query multiple times with the same query
- For simple modifications, validate_query is often enough
- Aim to complete in 3-5 tool calls when possible
- For follow-up requests, you already have schema context - go straight to query building
- If the user's request is simple (e.g., "show me users"), skip extensive planning

## RULES
- Only SELECT queries allowed
- Quote table/column names with double quotes
- Test complex queries before finalizing
- For JSON columns, check the jsonKeys in the schema to find the correct field names

## CHART GENERATION
After executing a query with execute_query, consider using generate_chart when:
- The query uses GROUP BY with aggregations (COUNT, SUM, AVG, etc.)
- The results show trends over time (dates with numeric values)
- The data compares categories or distributions
- There are 2-50 data points (good for visualization)

### Chart Type Selection Guide:
Choose the best chart type based on the data and analysis goal:

| Chart Type | Best For | Example Use Cases |
|------------|----------|-------------------|
| **column** | Comparing categories | Sales by region, counts by status, top products |
| **line** | Trends over time | Daily revenue, monthly signups, weekly metrics |
| **area** | Volume over time (stacked) | Traffic sources over time, cumulative values |
| **pie/donut** | Parts of whole (≤10 items) | Market share, category distribution, budget allocation |
| **scatter** | Correlation between 2 numerics | Price vs quantity, age vs income, performance metrics |
| **funnel** | Conversion/drop-off stages | Signup flow, sales pipeline, checkout process |
| **waterfall** | Cumulative sequential changes | Profit breakdown, budget changes, inventory flow |
| **heatmap** | 2D patterns/matrices | Activity by day/hour, correlation matrix, regional data |
| **radar** | Multi-metric comparison | Product feature comparison, performance scores |

To generate a chart, call generate_chart with:
- data: The rows from execute_query result
- columns: Array of {name, type} for each column (type: 'numeric', 'date', 'text', or 'unknown')
- chartType: Specify the type based on the guide above (auto-detection works but explicit is better)
- For funnel: ensure data has category + value columns (e.g., stage name + count)
- For waterfall: ensure sequential values showing changes (positive/negative deltas)
- For heatmap: need 2 category columns + 1 value column
- For radar: need 1 category column + multiple numeric metrics

IMPORTANT: Only generate charts for aggregated/analytical queries. Skip charts for:
- Raw data dumps (SELECT * without GROUP BY)
- Single row results
- Queries returning only text columns

## FINISHING (REQUIRED - FOLLOW EXACTLY)
**CRITICAL: You MUST complete ALL todo items BEFORE calling update_query_ui!**

Before finishing, verify:
1. Check that ALL todo items are either "completed" or "skipped" (none should be "pending" or "in_progress")
2. If any todos remain incomplete, continue working on them before proceeding
3. Mark each todo as "complete" using manage_todo(action="complete") as you finish it

Only when ALL todos are done:
1. Call update_query_ui with:
   - The final SQL query
   - A brief explanation of what it does${isFollowUp ? '\n   - What you changed from the previous query' : ''}
2. **IMMEDIATELY after update_query_ui, you MUST call set_query_name** with a descriptive name
   - This is REQUIRED - never skip this step!
   - Name should be 2-5 words describing what the query does
   - Examples: "Monthly Sales Report", "Active Users by Region", "Top Products Analysis"
   - The name should help users understand the query at a glance

**NEVER call update_query_ui or set_query_name while todos are still pending!**`;
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
    assumptions: [],
    dataQualityNotes: null,
    alternativeApproaches: [],
    todos: [],
    hasIncompleteTodos: false,
    stopReason: null,
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

  const model = anthropic(config.model || DEFAULT_MODEL);

  try {
    // Detect if this is a follow-up (has previous SQL context)
    const isFollowUp = !!config.previousSql;

    // Use Vercel AI SDK's native agent loop with streamText
    // stopWhen conditions: stop when set_query_name is called OR max steps reached
    // We stop on set_query_name (not update_query_ui) so the agent has a chance to name the query
    const result = streamText({
      model,
      system: buildSystemPrompt(state.goal, isFollowUp, config.previousContext),
      messages: [{ role: 'user', content: userContent }],
      tools,
      // Stop when the agent calls set_query_name (goal fully achieved) or after max steps
      stopWhen: [
        hasToolCall('set_query_name'),
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

          // Handle update_query_ui tool call to track completion and extract metadata
          if (part.toolName === 'update_query_ui') {
            const input = part.input as {
              sql: string;
              explanation: string;
              assumptions?: string[];
              dataQualityNotes?: string;
              alternativeApproaches?: { approach: string; reason: string }[];
            };
            if (input?.sql) {
              state.currentSql = formatSql(input.sql);
              state.hasCompletedGoal = true;
              // Extract transparency metadata
              if (input.assumptions) {
                state.assumptions = input.assumptions;
              }
              if (input.dataQualityNotes) {
                state.dataQualityNotes = input.dataQualityNotes;
              }
              if (input.alternativeApproaches) {
                state.alternativeApproaches = input.alternativeApproaches;
              }
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

            // Track todo state changes
            if (record.toolName === 'manage_todo' && record.result) {
              const todoResult = record.result as {
                success: boolean;
                action: string;
                items?: { id: string; text: string; status: string }[];
                item_id?: string;
              };

              if (todoResult.success) {
                if (todoResult.action === 'create' && todoResult.items) {
                  state.todos = todoResult.items;
                } else if (todoResult.action === 'complete' && todoResult.item_id) {
                  state.todos = state.todos.map(t =>
                    t.id === todoResult.item_id ? { ...t, status: 'completed' } : t
                  );
                } else if (todoResult.action === 'skip' && todoResult.item_id) {
                  state.todos = state.todos.map(t =>
                    t.id === todoResult.item_id ? { ...t, status: 'skipped' } : t
                  );
                } else if (todoResult.action === 'set_current' && todoResult.item_id) {
                  state.todos = state.todos.map(t => ({
                    ...t,
                    status: t.id === todoResult.item_id
                      ? 'in_progress'
                      : (t.status === 'in_progress' ? 'pending' : t.status)
                  }));
                } else if (todoResult.action === 'add') {
                  const addResult = record.result as { item?: { id: string; text: string; status: string } };
                  if (addResult.item) {
                    state.todos.push(addResult.item);
                  }
                }

                // Check if there are incomplete todos
                state.hasIncompleteTodos = state.todos.some(
                  t => t.status === 'pending' || t.status === 'in_progress'
                );
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
          // Determine stop reason
          if (state.currentStep >= MAX_AGENT_STEPS && !state.hasCompletedGoal) {
            state.reachedStepLimit = true;
            state.stopReason = 'step_limit';
          } else if (state.hasCompletedGoal) {
            // Check if there are incomplete todos even though goal is marked complete
            if (state.hasIncompleteTodos) {
              state.stopReason = 'incomplete_todos';
            } else {
              state.stopReason = 'goal_complete';
            }
          } else if (state.lastError) {
            state.stopReason = 'error';
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
