import { tool } from 'ai';
import { z } from 'zod';
import { Client } from 'pg';
import {
  detectChartType,
  suggestXAxis,
  suggestYAxes,
  isNumericType,
  isDateType,
  isTextType,
  type ChartType,
  type ChartConfig,
} from '@/lib/chart-utils';
import {
  analyzeDataQuality,
  filterGarbageData,
  summarizeDataQuality,
  type DataQualityReport,
  type DataQualityIssue,
} from './dataQuality';

// Dangerous SQL patterns that should NEVER be allowed
const DANGEROUS_PATTERNS = [
  /\bDELETE\s+FROM\b/i,
  /\bDROP\s+(TABLE|DATABASE|SCHEMA|INDEX|VIEW|FUNCTION|TRIGGER)\b/i,
  /\bTRUNCATE\s+(TABLE)?\b/i,
  /\bALTER\s+(TABLE|DATABASE|SCHEMA)\b/i,
  /\bCREATE\s+(TABLE|DATABASE|SCHEMA|INDEX)\b/i,
  /\bINSERT\s+INTO\b/i,
  /\bUPDATE\s+\w+\s+SET\b/i,
  /\bGRANT\b/i,
  /\bREVOKE\b/i,
  /\bEXEC(UTE)?\s*\(/i,
  /\bCALL\s+\w+/i,
];

function isMutationQuery(sql: string): boolean {
  const normalizedSql = sql.replace(/--.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(normalizedSql));
}

// Type for schema info passed to the tools
export interface SchemaInfo {
  name: string;
  schema: string;
  type: 'table' | 'view';
  columns: {
    name: string;
    type: string;
    isPrimaryKey: boolean;
  }[];
}

// Context for tool execution
export interface ToolContext {
  connectionString: string;
  schema: SchemaInfo[];
}

// Create a database client helper
async function createClient(connectionString: string): Promise<Client> {
  const client = new Client({ connectionString, connectionTimeoutMillis: 10000 });
  await client.connect();
  return client;
}

/**
 * Create agent tools with the given context
 */
export function createQueryAgentTools(context: ToolContext) {
  const { connectionString, schema } = context;

  return {
    // Tool 1: Get database schema
    get_table_schema: tool({
      description: `Get the complete database schema including all tables, views, and their column definitions.
Use this tool first to understand the database structure before writing queries.
Returns a list of tables with their columns, data types, and primary key information.`,
      inputSchema: z.object({
        includeViews: z.boolean().optional().describe('Whether to include views in the result. Defaults to true.'),
      }),
      execute: async ({ includeViews = true }) => {
        const filteredSchema = includeViews
          ? schema
          : schema.filter(t => t.type !== 'view');

        const result = filteredSchema.map(table => ({
          name: table.schema === 'public' ? `"${table.name}"` : `"${table.schema}"."${table.name}"`,
          type: table.type,
          columns: table.columns.map(col => ({
            name: col.name,
            type: col.type,
            isPrimaryKey: col.isPrimaryKey,
          })),
        }));

        return {
          tableCount: result.length,
          tables: result,
          hint: 'Use get_json_keys to explore JSON/JSONB column structures if needed.',
          error: null,
        };
      },
    }),

    // Tool 2: Get JSON keys
    get_json_keys: tool({
      description: `Extract the unique keys from a JSON or JSONB column to understand its structure.
Use this when you need to query a JSON field but don't know what keys it contains.
This helps you write correct JSON path expressions like data->>'fieldName'.`,
      inputSchema: z.object({
        table: z.string().describe('The table name (e.g., "users" or "schema"."table")'),
        column: z.string().describe('The JSON/JSONB column name to inspect'),
        nestedPath: z.string().optional().describe('Optional nested path to explore (e.g., "data" to get keys from column->\'data\')'),
        sampleValues: z.boolean().optional().describe('Whether to include sample values for each key. Defaults to false.'),
      }),
      execute: async ({ table, column, nestedPath, sampleValues = false }) => {
        const client = await createClient(connectionString);

        try {
          // Build the JSON path expression
          const jsonExpr = nestedPath
            ? `"${column}"->'${nestedPath}'`
            : `"${column}"`;

          // Get unique keys from the JSON field (limit to 50 for efficiency)
          const keysQuery = `
            SELECT DISTINCT jsonb_object_keys(${jsonExpr}::jsonb) as key
            FROM ${table}
            WHERE ${jsonExpr} IS NOT NULL
            LIMIT 50
          `;

          const keysResult = await client.query(keysQuery);
          const keys = keysResult.rows.map((r: Record<string, unknown>) => r.key as string);

          // Optionally get sample values for each key
          const samples: Record<string, unknown[]> = {};
          if (sampleValues && keys.length > 0) {
            for (const key of keys.slice(0, 10)) {
              const sampleQuery = `
                SELECT DISTINCT ${jsonExpr}->>'${key}' as value
                FROM ${table}
                WHERE ${jsonExpr}->>'${key}' IS NOT NULL
                LIMIT 3
              `;
              const sampleResult = await client.query(sampleQuery);
              samples[key] = sampleResult.rows.map((r: Record<string, unknown>) => r.value);
            }
          }

          return {
            table,
            column,
            nestedPath: nestedPath ?? null,
            keys,
            keyCount: keys.length,
            // Use null instead of undefined to prevent JSON serialization issues
            sampleValues: sampleValues ? samples : null,
            hint: keys.length === 0
              ? 'No keys found. The column might be empty, an array, or have a different structure.'
              : `Found ${keys.length} unique keys. Use these in your query like: ${column}->>'${keys[0]}'`,
            error: null,
            suggestion: null,
          };
        } catch (error) {
          return {
            table,
            column,
            nestedPath: nestedPath ?? null,
            keys: null,
            keyCount: null,
            sampleValues: null,
            hint: null,
            error: error instanceof Error ? error.message : 'Failed to get JSON keys',
            suggestion: 'Check that the table and column names are correct.',
          };
        } finally {
          await client.end();
        }
      },
    }),

    // Tool 3: Execute query
    execute_query: tool({
      description: `Execute a read-only SQL query against the database and return results.
IMPORTANT: Only SELECT queries are allowed. Any INSERT, UPDATE, DELETE, DROP, or other mutation queries will be rejected.
Use this to test your queries, explore data, or verify your results match the user's goal.
The query will automatically have a LIMIT applied if none is specified.

REQUIRED: Always provide a title and description for the query so users understand what it does.`,
      inputSchema: z.object({
        sql: z.string().describe('The SQL SELECT query to execute'),
        title: z.string().describe('Short title describing what this query does (e.g., "Sales by Region", "Active Users Count")'),
        description: z.string().describe('Brief explanation of what this query retrieves and why (1-2 sentences)'),
        limit: z.number().optional().describe('Maximum number of rows to return. Defaults to 100. Max is 1000.'),
      }),
      execute: async ({ sql, title, description, limit = 100 }) => {
        // Validate it's a read-only query
        if (isMutationQuery(sql)) {
          return {
            success: false,
            error: 'Query rejected: Only SELECT queries are allowed. Mutation queries are blocked for safety.',
            suggestion: 'Rewrite as a SELECT query to read data instead of modifying it.',
            rowCount: null,
            executionTime: null,
            columns: null,
            rows: null,
            hasMoreRows: null,
            warning: null,
            emptyColumns: null,
            title: title ?? null,
            description: description ?? null,
          };
        }

        const normalizedSql = sql.trim().toUpperCase();
        if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH') && !normalizedSql.startsWith('EXPLAIN')) {
          return {
            success: false,
            error: 'Query must start with SELECT, WITH, or EXPLAIN.',
            suggestion: 'Start your query with SELECT to read data from the database.',
            rowCount: null,
            executionTime: null,
            columns: null,
            rows: null,
            hasMoreRows: null,
            warning: null,
            emptyColumns: null,
            title: title ?? null,
            description: description ?? null,
          };
        }

        // Add LIMIT if not present
        const effectiveLimit = Math.min(limit, 1000);
        let queryToRun = sql.trim();
        if (queryToRun.endsWith(';')) {
          queryToRun = queryToRun.slice(0, -1);
        }

        if (!/\bLIMIT\s+\d+/i.test(queryToRun)) {
          queryToRun = `${queryToRun} LIMIT ${effectiveLimit}`;
        }

        const client = await createClient(connectionString);
        const startTime = Date.now();

        try {
          const result = await client.query(queryToRun);
          const executionTime = Date.now() - startTime;

          // Perform comprehensive data quality analysis
          const columnNames = result.fields.map((f: { name: string; dataTypeID: number }) => f.name);
          const dataQualityReport = analyzeDataQuality(result.rows, columnNames);

          // Legacy: maintain emptyColumns for backwards compatibility
          const emptyColumns = dataQualityReport.issues
            .filter(i => i.issueType === 'all_null')
            .map(i => i.column);

          // Build warnings from data quality issues
          const warnings: string[] = [];
          const criticalIssues = dataQualityReport.issues.filter(i => i.severity === 'critical');
          const warningIssues = dataQualityReport.issues.filter(i => i.severity === 'warning');

          if (criticalIssues.length > 0) {
            warnings.push(`Critical data quality issues: ${criticalIssues.map(i => i.description).join('; ')}`);
          }
          if (warningIssues.length > 0) {
            warnings.push(`Data quality warnings: ${warningIssues.map(i => i.description).join('; ')}`);
          }

          return {
            success: true,
            rowCount: result.rowCount || 0,
            executionTime,
            columns: columnNames,
            rows: result.rows.slice(0, 5), // Return first 5 rows as sample
            hasMoreRows: (result.rowCount || 0) > 5,
            // Use null instead of undefined for optional fields to prevent JSON serialization issues
            warning: warnings.length > 0 ? warnings.join(' ') : null,
            emptyColumns: emptyColumns.length > 0 ? emptyColumns : null,
            title: title ?? null,
            description: description ?? null,
            // Enhanced data quality information
            dataQuality: {
              score: dataQualityReport.qualityScore,
              overallQuality: dataQualityReport.overallQuality,
              issueCount: dataQualityReport.issues.length,
              issues: dataQualityReport.issues.slice(0, 5), // Limit to top 5 issues
              columnStats: dataQualityReport.columnStats.map(cs => ({
                name: cs.name,
                type: cs.inferredType,
                nullPercentage: cs.nullPercentage,
                uniqueCount: cs.uniqueCount,
              })),
            },
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            success: false,
            error: errorMessage,
            suggestion: errorMessage.includes('column')
              ? 'Check column names against the schema. Use get_table_schema or get_json_keys to verify field names.'
              : errorMessage.includes('syntax')
              ? 'There is a syntax error in your SQL. Review the query structure.'
              : 'Review the query and try again.',
            // Include consistent fields with null to prevent schema issues
            rowCount: null,
            executionTime: null,
            columns: null,
            rows: null,
            hasMoreRows: null,
            warning: null,
            emptyColumns: null,
            title: title ?? null,
            description: description ?? null,
          };
        } finally {
          await client.end();
        }
      },
    }),

    // Tool 4: Validate query
    validate_query: tool({
      description: `Validate that a SQL query is syntactically correct PostgreSQL without actually running it.
Use EXPLAIN to check query validity and get execution plan information.
This is useful for validating complex queries before proposing them to the user.`,
      inputSchema: z.object({
        sql: z.string().describe('The SQL query to validate'),
      }),
      execute: async ({ sql }) => {
        // First, basic validation
        const normalizedSql = sql.trim().toUpperCase();
        if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH')) {
          return {
            isValid: false,
            message: null,
            error: 'Query must start with SELECT or WITH',
            suggestion: null,
          };
        }

        // Check for dangerous patterns
        if (isMutationQuery(sql)) {
          return {
            isValid: false,
            message: null,
            error: 'Query contains disallowed keywords. Only SELECT queries are permitted.',
            suggestion: null,
          };
        }

        const client = await createClient(connectionString);

        try {
          let queryToValidate = sql.trim();
          if (queryToValidate.endsWith(';')) {
            queryToValidate = queryToValidate.slice(0, -1);
          }

          await client.query(`EXPLAIN ${queryToValidate}`);

          return {
            isValid: true,
            message: 'Query is syntactically valid PostgreSQL',
            error: null,
            suggestion: null,
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            isValid: false,
            message: null,
            error: errorMessage,
            suggestion: errorMessage.includes('column')
              ? 'A referenced column does not exist. Check column names against the schema.'
              : errorMessage.includes('relation')
              ? 'A referenced table does not exist. Use get_table_schema to see available tables.'
              : errorMessage.includes('syntax')
              ? 'There is a syntax error in the query. Review SQL syntax.'
              : 'Review the query and fix the issue.',
          };
        } finally {
          await client.end();
        }
      },
    }),

    // Tool 5: Update query UI (signals completion)
    update_query_ui: tool({
      description: `Update the query in the UI for the user to review and run.
Call this when you have a final query that meets the user's goal.
The user will be able to see the query, review it, modify it, and run it.
Include a clear explanation of what the query does and why it meets their goal.
THIS IS THE FINAL STEP - call this when you have a working query.

REQUIRED: Provide a brief summary of key findings AND list any assumptions made.
IMPORTANT: Always document assumptions made during analysis, especially:
- Data filtering decisions (e.g., excluded NULL values, filtered outliers)
- Interpretation choices (e.g., assumed 'date' meant 'created_at' column)
- Default values used (e.g., used 30-day window when no date range specified)
- Ambiguity resolutions (e.g., chose specific table when multiple options existed)`,
      inputSchema: z.object({
        sql: z.string().describe('The final SQL query to display to the user'),
        explanation: z.string().describe('Clear explanation of what this query does and how it addresses the user\'s goal'),
        summary: z.string().describe('Brief summary of findings from the analysis (2-3 sentences highlighting key insights or what the data shows)'),
        assumptions: z.array(z.string()).describe('List of assumptions made during analysis, especially those affecting data quality or interpretation. Include filtering decisions, column choices, and default values used.'),
        dataQualityNotes: z.string().optional().describe('Notes about data quality issues found and how they were handled'),
        alternativeApproaches: z.array(z.object({
          approach: z.string().describe('Brief description of the alternative approach'),
          reason: z.string().describe('Why this approach was not chosen'),
        })).optional().describe('Other approaches considered and why the chosen approach was preferred'),
        changes: z.array(z.string()).optional().describe('List of changes made from the previous query, if this is a modification'),
        confidence: z.enum(['high', 'medium', 'low']).optional().describe('Your confidence that this query meets the user\'s goal'),
        suggestions: z.array(z.string()).optional().describe('Optional suggestions for the user to refine the query further'),
      }),
      execute: async ({ sql, explanation, summary, assumptions, dataQualityNotes, alternativeApproaches, changes, confidence = 'high', suggestions }) => {
        // This tool signals completion - the result is used by the agent orchestrator
        return {
          action: 'updateUI',
          sql,
          explanation,
          summary: summary || '',
          assumptions: assumptions || [],
          dataQualityNotes: dataQualityNotes || null,
          alternativeApproaches: alternativeApproaches || [],
          changes: changes || [],
          confidence,
          suggestions: suggestions || [],
          message: 'Query has been updated in the editor for user review.',
        };
      },
    }),

    // Tool 6: Generate chart visualization
    generate_chart: tool({
      description: `Generate a chart visualization for query results.
Use this after executing a query when the results would benefit from a visual representation.
Good candidates for charts:
- Aggregated data with GROUP BY (counts, sums, averages)
- Time series data (data over time)
- Comparisons between categories
- Distribution of values

Do NOT use for:
- Single row results
- Raw data without aggregation
- Results with many columns but few numeric values
- Text-only results

REQUIRED: Always provide a title and description so users understand the visualization.`,
      inputSchema: z.object({
        data: z.array(z.record(z.string(), z.unknown())).describe('The query result rows to visualize'),
        columns: z.array(z.object({
          name: z.string(),
          type: z.enum(['numeric', 'date', 'text', 'unknown']),
        })).describe('Column metadata from the query result'),
        title: z.string().describe('Short title for the chart (e.g., "Monthly Revenue Trend", "Users by Country")'),
        description: z.string().describe('Brief explanation of what the visualization shows and key insights (1-2 sentences)'),
        chartType: z.enum(['column', 'line', 'area', 'pie']).optional().describe('Override automatic chart type detection'),
        xAxis: z.string().optional().describe('Override X-axis column selection'),
        yAxes: z.array(z.string()).optional().describe('Override Y-axis columns selection'),
        stacked: z.boolean().optional().describe('Whether to stack the chart (for column/area charts)'),
      }),
      execute: async ({ data, columns, title, description, chartType, xAxis, yAxes, stacked = false }) => {
        if (!data || data.length === 0) {
          return {
            success: false,
            error: 'No data provided for chart generation',
            chartConfig: null,
            chartData: null,
            title: title ?? null,
            description: description ?? null,
          };
        }

        // Build a mock result structure for chart utils
        const mockFields = columns.map(col => ({
          name: col.name,
          dataTypeID: col.type === 'numeric' ? 23 : col.type === 'date' ? 1082 : 25,
        }));

        const mockResult = {
          rows: data,
          fields: mockFields,
          rowCount: data.length,
          executionTime: 0,
        };

        // Determine chart type
        let detectedType: ChartType = chartType || 'column';
        if (!chartType) {
          // Auto-detect based on data
          const hasDate = columns.some(c => c.type === 'date');
          const numericCount = columns.filter(c => c.type === 'numeric').length;
          const textCount = columns.filter(c => c.type === 'text').length;

          if (hasDate && numericCount >= 1) {
            detectedType = 'line';
          } else if (textCount === 1 && numericCount === 1 && data.length <= 10) {
            detectedType = 'pie';
          } else if (textCount >= 1 && numericCount >= 1) {
            detectedType = 'column';
          }
        }

        // Determine axes
        let finalXAxis = xAxis;
        let finalYAxes = yAxes || [];

        if (!finalXAxis) {
          // Prefer date > text > first column
          const dateCol = columns.find(c => c.type === 'date');
          const textCol = columns.find(c => c.type === 'text');
          finalXAxis = dateCol?.name || textCol?.name || columns[0]?.name;
        }

        if (finalYAxes.length === 0) {
          // Use all numeric columns not used as X-axis
          finalYAxes = columns
            .filter(c => c.type === 'numeric' && c.name !== finalXAxis)
            .map(c => c.name);
        }

        if (!finalXAxis || finalYAxes.length === 0) {
          return {
            success: false,
            error: 'Cannot determine chart axes. Need at least one category column and one numeric column.',
            chartConfig: null,
            chartData: null,
            hint: 'Ensure your query returns at least one text/date column for the X-axis and one numeric column for values.',
            title: title ?? null,
            description: description ?? null,
          };
        }

        // Prepare chart data
        const chartData = data.map(row => {
          const transformed: Record<string, unknown> = {};
          transformed[finalXAxis!] = row[finalXAxis!];
          finalYAxes.forEach(yKey => {
            const value = row[yKey];
            transformed[yKey] = typeof value === 'number' ? value : parseFloat(String(value)) || 0;
          });
          return transformed;
        });

        const chartConfig: ChartConfig = {
          type: detectedType,
          xAxis: finalXAxis,
          yAxes: finalYAxes,
          stacked,
          title,
        };

        return {
          success: true,
          chartConfig,
          chartData,
          xAxisKey: finalXAxis,
          yAxisKeys: finalYAxes,
          dataPointCount: data.length,
          message: `Generated ${detectedType} chart with ${data.length} data points`,
          error: null,
          title: title ?? null,
          description: description ?? null,
        };
      },
    }),

    // Tool 7: Manage todo list for complex queries
    manage_todo: tool({
      description: `Manage a todo list to track progress on complex queries.
Use this tool to create a plan at the start of complex queries, and update progress as you work.

WHEN TO USE:
- At the START of complex queries requiring multiple steps (3+ steps)
- When you need to explore unknown schema
- When the user's request involves multiple tables or aggregations
- When you discover new requirements during execution

ACTIONS:
- "create": Initialize the todo list with planned steps (call once at start)
- "set_current": Mark which item you're currently working on
- "complete": Mark an item as done
- "skip": Skip an item that's no longer needed
- "add": Add a new item discovered during execution

GOOD TODO ITEMS (specific and actionable):
- "Get schema for users table"
- "Find date column for time filtering"
- "Test query with sample data"
- "Add GROUP BY for aggregation"

BAD TODO ITEMS (too vague):
- "Understand the data"
- "Build the query"
- "Fix issues"`,
      inputSchema: z.object({
        action: z.enum(['create', 'set_current', 'complete', 'skip', 'add']).describe('The action to perform'),
        items: z.array(z.string()).optional().describe('For "create": List of todo items to initialize'),
        item_id: z.string().optional().describe('For "set_current", "complete", "skip": The ID of the item to update'),
        item_text: z.string().optional().describe('For "add": The text for the new todo item'),
      }),
      execute: async ({ action, items, item_id, item_text }) => {
        // This tool doesn't execute anything - it signals to the orchestrator to update UI state
        // The actual state update happens in the hook that handles tool results
        switch (action) {
          case 'create':
            if (!items || items.length === 0) {
              return {
                success: false,
                error: 'Must provide items array for create action',
                action,
              };
            }
            return {
              success: true,
              action: 'create',
              items: items.map((text, index) => ({
                id: `todo-${Date.now()}-${index}`,
                text,
                status: index === 0 ? 'in_progress' : 'pending',
              })),
              message: `Created todo list with ${items.length} items`,
            };

          case 'set_current':
            if (!item_id) {
              return {
                success: false,
                error: 'Must provide item_id for set_current action',
                action,
              };
            }
            return {
              success: true,
              action: 'set_current',
              item_id,
              message: `Set current item to ${item_id}`,
            };

          case 'complete':
            if (!item_id) {
              return {
                success: false,
                error: 'Must provide item_id for complete action',
                action,
              };
            }
            return {
              success: true,
              action: 'complete',
              item_id,
              message: `Marked ${item_id} as completed`,
            };

          case 'skip':
            if (!item_id) {
              return {
                success: false,
                error: 'Must provide item_id for skip action',
                action,
              };
            }
            return {
              success: true,
              action: 'skip',
              item_id,
              message: `Skipped ${item_id}`,
            };

          case 'add':
            if (!item_text) {
              return {
                success: false,
                error: 'Must provide item_text for add action',
                action,
              };
            }
            return {
              success: true,
              action: 'add',
              item: {
                id: `todo-${Date.now()}-new`,
                text: item_text,
                status: 'pending',
                addedDuringExecution: true,
              },
              message: `Added new todo: ${item_text}`,
            };

          default:
            return {
              success: false,
              error: `Unknown action: ${action}`,
              action,
            };
        }
      },
    }),

    // Tool 8: Analyze data quality
    analyze_data_quality: tool({
      description: `Analyze data quality for a query's results to detect issues like NULL values, zeros, infinite values, type mismatches, and outliers.
Use this tool after executing a query to understand data quality before finalizing.
This helps you make informed decisions about filtering and alerts you to potential data issues.

When to use:
- After execute_query to assess result quality
- When you notice many NULL values or suspicious patterns
- Before finalizing a query to check for data issues
- When aggregation results seem unexpected

The tool provides a quality score (0-100) and specific issues to address.`,
      inputSchema: z.object({
        rows: z.array(z.record(z.string(), z.unknown())).describe('The query result rows to analyze'),
        columns: z.array(z.string()).describe('Column names from the query result'),
        applyFiltering: z.boolean().optional().describe('Whether to filter out garbage data and return cleaned results'),
        filterOptions: z.object({
          removeNulls: z.union([z.boolean(), z.array(z.string())]).optional().describe('Remove rows with NULL values (true for all columns, or array of specific column names)'),
          removeZeros: z.union([z.boolean(), z.array(z.string())]).optional().describe('Remove rows with zero values'),
          removeInfinites: z.union([z.boolean(), z.array(z.string())]).optional().describe('Remove rows with infinite values'),
          removeEmptyStrings: z.union([z.boolean(), z.array(z.string())]).optional().describe('Remove rows with empty strings'),
        }).optional().describe('Options for filtering garbage data'),
      }),
      execute: async ({ rows, columns, applyFiltering = false, filterOptions = {} }) => {
        if (!rows || rows.length === 0) {
          return {
            success: true,
            report: {
              totalRows: 0,
              totalColumns: columns.length,
              issues: [],
              qualityScore: 100,
              overallQuality: 'good',
              summary: 'No data to analyze.',
            },
            filteredData: null,
            filteringApplied: false,
          };
        }

        // Perform data quality analysis
        const report = analyzeDataQuality(rows, columns);

        let filteredResult = null;
        if (applyFiltering && Object.keys(filterOptions).length > 0) {
          filteredResult = filterGarbageData(rows, columns, filterOptions);
          report.filteringApplied = true;
          report.filteredRowCount = filteredResult.filteredRows.length;
        }

        return {
          success: true,
          report: {
            totalRows: report.totalRows,
            totalColumns: report.totalColumns,
            issues: report.issues.map(issue => ({
              column: issue.column,
              type: issue.issueType,
              severity: issue.severity,
              description: issue.description,
              percentage: issue.percentage,
              suggestion: issue.suggestion,
            })),
            columnStats: report.columnStats.map(cs => ({
              name: cs.name,
              inferredType: cs.inferredType,
              nullPercentage: cs.nullPercentage,
              uniqueCount: cs.uniqueCount,
              zeroCount: cs.zeroCount ?? null,
              infiniteCount: cs.infiniteCount ?? null,
            })),
            qualityScore: report.qualityScore,
            overallQuality: report.overallQuality,
            summary: summarizeDataQuality(report),
          },
          filteredData: filteredResult ? {
            rows: filteredResult.filteredRows.slice(0, 5), // Sample of filtered data
            totalFilteredRows: filteredResult.filteredRows.length,
            removedCount: filteredResult.removedCount,
            removedReasons: filteredResult.removedReasons,
          } : null,
          filteringApplied: applyFiltering,
          hint: report.qualityScore < 50
            ? 'Data quality is poor. Consider filtering out problematic rows or verifying column names.'
            : report.qualityScore < 80
            ? 'Some data quality issues detected. Review the issues and consider filtering if needed.'
            : 'Data quality is good.',
        };
      },
    }),

    // Tool 9: Set query name
    set_query_name: tool({
      description: `Set a descriptive name for the current query.
Use this tool to give the query a clear, concise name that describes what it does.

WHEN TO USE:
- After successfully building a query with update_query_ui
- When you understand what the query retrieves
- To help users identify and organize their queries

NAME GUIDELINES:
- Keep it short (2-5 words)
- Be descriptive and specific (e.g., "Monthly Revenue by Region", "Active Users Last Week")
- Avoid generic names like "Query 1" or "New Query"
- Use title case
- Focus on what the data shows, not how it's retrieved`,
      inputSchema: z.object({
        name: z.string().describe('A short, descriptive name for the query (2-5 words, title case)'),
      }),
      execute: async ({ name }) => {
        // Validate and clean the name
        const cleanedName = name.trim().slice(0, 100);

        if (!cleanedName) {
          return {
            success: false,
            error: 'Name cannot be empty',
            name: null,
          };
        }

        return {
          success: true,
          name: cleanedName,
          message: `Query name set to: ${cleanedName}`,
        };
      },
    }),
  };
}

export type QueryAgentTools = ReturnType<typeof createQueryAgentTools>;
