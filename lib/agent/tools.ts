/* eslint-disable @typescript-eslint/no-explicit-any */
import { tool } from 'ai';
import { z } from 'zod';
import { Client } from 'pg';

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
      parameters: z.object({
        includeViews: z.boolean().optional().describe('Whether to include views in the result. Defaults to true.'),
      }),
      execute: async (args: any) => {
        const { includeViews = true } = args;
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
        };
      },
    }) as any,

    // Tool 2: Get JSON keys
    get_json_keys: tool({
      description: `Extract the unique keys from a JSON or JSONB column to understand its structure.
Use this when you need to query a JSON field but don't know what keys it contains.
This helps you write correct JSON path expressions like data->>'fieldName'.`,
      parameters: z.object({
        table: z.string().describe('The table name (e.g., "users" or "schema"."table")'),
        column: z.string().describe('The JSON/JSONB column name to inspect'),
        nestedPath: z.string().optional().describe('Optional nested path to explore (e.g., "data" to get keys from column->\'data\')'),
        sampleValues: z.boolean().optional().describe('Whether to include sample values for each key. Defaults to false.'),
      }),
      execute: async (args: any) => {
        const { table, column, nestedPath, sampleValues = false } = args;
        const client = await createClient(connectionString);

        try {
          // Build the JSON path expression
          const jsonExpr = nestedPath
            ? `"${column}"->'${nestedPath}'`
            : `"${column}"`;

          // Get unique keys from the JSON field
          const keysQuery = `
            SELECT DISTINCT jsonb_object_keys(${jsonExpr}::jsonb) as key
            FROM ${table}
            WHERE ${jsonExpr} IS NOT NULL
            LIMIT 100
          `;

          const keysResult = await client.query(keysQuery);
          const keys = keysResult.rows.map((r: any) => r.key as string);

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
              samples[key] = sampleResult.rows.map((r: any) => r.value);
            }
          }

          return {
            table,
            column,
            nestedPath: nestedPath || null,
            keys,
            keyCount: keys.length,
            ...(sampleValues ? { sampleValues: samples } : {}),
            hint: keys.length === 0
              ? 'No keys found. The column might be empty, an array, or have a different structure.'
              : `Found ${keys.length} unique keys. Use these in your query like: ${column}->>'${keys[0]}'`,
          };
        } catch (error) {
          return {
            error: error instanceof Error ? error.message : 'Failed to get JSON keys',
            suggestion: 'Check that the table and column names are correct.',
          };
        } finally {
          await client.end();
        }
      },
    }) as any,

    // Tool 3: Execute query
    execute_query: tool({
      description: `Execute a read-only SQL query against the database and return results.
IMPORTANT: Only SELECT queries are allowed. Any INSERT, UPDATE, DELETE, DROP, or other mutation queries will be rejected.
Use this to test your queries, explore data, or verify your results match the user's goal.
The query will automatically have a LIMIT applied if none is specified.`,
      parameters: z.object({
        sql: z.string().describe('The SQL SELECT query to execute'),
        limit: z.number().optional().describe('Maximum number of rows to return. Defaults to 100. Max is 1000.'),
        purpose: z.string().optional().describe('Brief description of why you are running this query (for logging)'),
      }),
      execute: async (args: any) => {
        const { sql, limit = 100, purpose } = args;

        // Validate it's a read-only query
        if (isMutationQuery(sql)) {
          return {
            success: false,
            error: 'Query rejected: Only SELECT queries are allowed. Mutation queries are blocked for safety.',
            suggestion: 'Rewrite as a SELECT query to read data instead of modifying it.',
          };
        }

        const normalizedSql = sql.trim().toUpperCase();
        if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH') && !normalizedSql.startsWith('EXPLAIN')) {
          return {
            success: false,
            error: 'Query must start with SELECT, WITH, or EXPLAIN.',
            suggestion: 'Start your query with SELECT to read data from the database.',
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

          // Analyze results for potential issues
          const emptyColumns: string[] = [];
          if (result.rows.length > 0) {
            for (const field of result.fields) {
              const allNull = result.rows.every((row: any) => row[field.name] === null);
              if (allNull) {
                emptyColumns.push(field.name);
              }
            }
          }

          return {
            success: true,
            rowCount: result.rowCount || 0,
            executionTime,
            columns: result.fields.map((f: any) => ({ name: f.name, dataTypeId: f.dataTypeID })),
            rows: result.rows.slice(0, 10), // Return first 10 rows as sample
            hasMoreRows: (result.rowCount || 0) > 10,
            ...(emptyColumns.length > 0 ? {
              warning: `These columns returned all NULL values: ${emptyColumns.join(', ')}. This might indicate wrong field names or JSON paths.`,
              emptyColumns,
            } : {}),
            purpose,
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
          };
        } finally {
          await client.end();
        }
      },
    }) as any,

    // Tool 4: Validate query
    validate_query: tool({
      description: `Validate that a SQL query is syntactically correct PostgreSQL without actually running it.
Use EXPLAIN to check query validity and get execution plan information.
This is useful for validating complex queries before proposing them to the user.`,
      parameters: z.object({
        sql: z.string().describe('The SQL query to validate'),
      }),
      execute: async (args: any) => {
        const { sql } = args;

        // First, basic validation
        const normalizedSql = sql.trim().toUpperCase();
        if (!normalizedSql.startsWith('SELECT') && !normalizedSql.startsWith('WITH')) {
          return {
            isValid: false,
            error: 'Query must start with SELECT or WITH',
          };
        }

        // Check for dangerous patterns
        if (isMutationQuery(sql)) {
          return {
            isValid: false,
            error: 'Query contains disallowed keywords. Only SELECT queries are permitted.',
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
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return {
            isValid: false,
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
    }) as any,

    // Tool 5: Update query UI (signals completion)
    update_query_ui: tool({
      description: `Update the query in the UI for the user to review and run.
Call this when you have a final query that meets the user's goal.
The user will be able to see the query, review it, modify it, and run it.
Include a clear explanation of what the query does and why it meets their goal.
THIS IS THE FINAL STEP - call this when you have a working query.`,
      parameters: z.object({
        sql: z.string().describe('The final SQL query to display to the user'),
        explanation: z.string().describe('Clear explanation of what this query does and how it addresses the user\'s goal'),
        changes: z.array(z.string()).optional().describe('List of changes made from the previous query, if this is a modification'),
        confidence: z.enum(['high', 'medium', 'low']).optional().describe('Your confidence that this query meets the user\'s goal'),
        suggestions: z.array(z.string()).optional().describe('Optional suggestions for the user to refine the query further'),
      }),
      execute: async (args: any) => {
        const { sql, explanation, changes, confidence = 'high', suggestions } = args;
        // This tool signals completion - the result is used by the agent orchestrator
        return {
          action: 'updateUI',
          sql,
          explanation,
          changes: changes || [],
          confidence,
          suggestions: suggestions || [],
          message: 'Query has been updated in the editor for user review.',
        };
      },
    }) as any,
  };
}

export type QueryAgentTools = ReturnType<typeof createQueryAgentTools>;
