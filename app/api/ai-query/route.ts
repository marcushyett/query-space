import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SchemaTable } from '@/app/api/schema/route';
import { formatSql } from '@/lib/sql-formatter';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface TableSample {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  jsonFieldSamples?: Record<string, unknown[]>;
}

interface QueryResultInfo {
  rowCount: number;
  executionTime: number;
  sampleRows?: Record<string, unknown>[];
  emptyColumns?: string[];
  error?: string;
}

interface AiQueryRequest {
  prompt: string;
  apiKey: string;
  schema: SchemaTable[];
  conversationHistory?: ConversationMessage[];
  currentSql?: string;
  sampleData?: TableSample[];
  queryResult?: QueryResultInfo;
  isAutoFix?: boolean;
  isDebugMode?: boolean;
  mode?: 'generate' | 'validate' | 'debug';
}

interface AiQueryResponse {
  sql: string;
  explanation: string;
  changes?: string[];
  validation?: {
    isValid: boolean;
    issues?: string[];
    suggestions?: string[];
  };
  debugInfo?: {
    needsMoreData: boolean;
    suggestedQueries?: string[];
    diagnosis?: string;
  };
}

// DANGEROUS SQL patterns that should NEVER be allowed
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

function formatSchemaForPrompt(schema: SchemaTable[]): string {
  if (!schema || schema.length === 0) {
    return 'No schema information available.';
  }

  const lines: string[] = ['Database Schema (PostgreSQL):', ''];

  for (const table of schema) {
    const quotedSchema = `"${table.schema}"`;
    const quotedTable = `"${table.name}"`;
    const fullName = table.schema === 'public'
      ? quotedTable
      : `${quotedSchema}.${quotedTable}`;
    const typeLabel = table.type === 'view' ? 'VIEW' : 'TABLE';
    lines.push(`${typeLabel}: ${fullName}`);

    if (table.columns && table.columns.length > 0) {
      for (const column of table.columns) {
        const pkIndicator = column.isPrimaryKey ? ' (PRIMARY KEY)' : '';
        lines.push(`  - "${column.name}": ${column.type}${pkIndicator}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatSampleDataForPrompt(samples: TableSample[]): string {
  if (!samples || samples.length === 0) {
    return '';
  }

  const lines: string[] = ['', 'Sample Data (for understanding field values and JSON structure):', ''];

  for (const sample of samples) {
    lines.push(`Table: ${sample.table}`);

    // Show JSON field samples first if available
    if (sample.jsonFieldSamples && Object.keys(sample.jsonFieldSamples).length > 0) {
      lines.push('  JSON Field Structures:');
      for (const [field, values] of Object.entries(sample.jsonFieldSamples)) {
        lines.push(`    "${field}" examples:`);
        for (const value of values) {
          lines.push(`      ${JSON.stringify(value, null, 2).split('\n').join('\n      ')}`);
        }
      }
    }

    // Show sample rows (limited)
    if (sample.rows && sample.rows.length > 0) {
      lines.push('  Sample rows:');
      for (const row of sample.rows.slice(0, 2)) {
        const rowStr = Object.entries(row)
          .map(([k, v]) => `"${k}": ${JSON.stringify(v)}`)
          .join(', ');
        lines.push(`    { ${rowStr} }`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function formatQueryResultForPrompt(result: QueryResultInfo): string {
  if (!result) return '';

  const lines: string[] = ['', 'Query Execution Result:', ''];

  if (result.error) {
    lines.push(`ERROR: ${result.error}`);
  } else {
    lines.push(`Rows returned: ${result.rowCount}`);
    lines.push(`Execution time: ${result.executionTime}ms`);

    if (result.emptyColumns && result.emptyColumns.length > 0) {
      lines.push(`WARNING: These columns returned all NULL/empty values: ${result.emptyColumns.join(', ')}`);
    }

    if (result.sampleRows && result.sampleRows.length > 0) {
      lines.push('Sample of returned data:');
      for (const row of result.sampleRows.slice(0, 3)) {
        lines.push(`  ${JSON.stringify(row)}`);
      }
    }
  }

  return lines.join('\n');
}

function buildConversationMessages(
  conversationHistory: ConversationMessage[],
  schemaContext: string,
  sampleDataContext: string,
  currentSql: string | undefined,
  queryResultContext: string,
  newPrompt: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  let userMessage = '';

  // Include schema context on first message
  if (conversationHistory.length === 0) {
    userMessage = `${schemaContext}${sampleDataContext}\n\n`;
  }

  // Include current SQL if available
  if (currentSql && conversationHistory.length > 0) {
    userMessage += `Current SQL query:\n\`\`\`sql\n${currentSql}\n\`\`\`\n\n`;
  }

  // Include query result context if available
  if (queryResultContext) {
    userMessage += `${queryResultContext}\n\n`;
  }

  userMessage += `User request: ${newPrompt.trim()}`;

  messages.push({
    role: 'user',
    content: userMessage,
  });

  return messages;
}

export async function POST(request: NextRequest) {
  try {
    const body: AiQueryRequest = await request.json();
    const {
      prompt,
      apiKey,
      schema,
      conversationHistory = [],
      currentSql,
      sampleData,
      queryResult,
      isDebugMode,
      mode = 'generate',
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    const effectiveApiKey = apiKey || process.env.CLAUDE_API_KEY;

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please provide your Claude API key.' },
        { status: 400 }
      );
    }

    const schemaContext = formatSchemaForPrompt(schema || []);
    const sampleDataContext = formatSampleDataForPrompt(sampleData || []);
    const queryResultContext = formatQueryResultForPrompt(queryResult!);
    const isFollowUp = conversationHistory.length > 0;

    const anthropic = new Anthropic({
      apiKey: effectiveApiKey,
    });

    // Build mode-specific system prompt
    let systemPrompt = '';

    if (mode === 'validate') {
      systemPrompt = `You are a PostgreSQL query validator. Analyze the query results and determine if they are sensible.

Your response must be valid JSON:
{
  "sql": "the original SQL unchanged",
  "explanation": "Brief analysis of the results",
  "validation": {
    "isValid": true/false,
    "issues": ["Issue 1", "Issue 2"], // Only if problems found
    "suggestions": ["Suggestion 1"] // Optional improvements
  }
}

Check for these issues:
- All columns returning NULL values
- Unexpected empty result sets
- Data that seems malformed or inconsistent
- Missing expected data patterns

Be helpful but don't be overly critical of valid results. Focus on serious data quality issues, not the values themselves.

IMPORTANT: Return ONLY valid JSON, no markdown.`;
    } else if (mode === 'debug') {
      systemPrompt = `You are a PostgreSQL query debugger. Diagnose why a query returned no rows or unexpected results.

Your response must be valid JSON:
{
  "sql": "Corrected SQL query or diagnostic query",
  "explanation": "Explanation of the issue and fix",
  "debugInfo": {
    "needsMoreData": true/false,
    "suggestedQueries": ["SELECT ... to check data"], // Diagnostic queries if needed
    "diagnosis": "Root cause analysis"
  }
}

Common issues to check:
1. Wrong field names in WHERE/JOIN conditions
2. Incorrect JSON path operators (-> vs ->>)
3. Type mismatches (comparing text to numbers)
4. Missing data in the source tables
5. Overly restrictive WHERE conditions
6. JOIN conditions that don't match any rows

If you need to explore the data to diagnose, set needsMoreData to true and provide diagnostic queries.

IMPORTANT: Return ONLY valid JSON, no markdown. NEVER generate INSERT, UPDATE, DELETE, DROP, or any mutation queries.`;
    } else {
      // Generate mode
      systemPrompt = `You are a PostgreSQL SQL expert assistant helping users build and refine queries through conversation.

CRITICAL SAFETY RULE: You must NEVER generate queries that modify data. This means:
- NO INSERT, UPDATE, DELETE statements
- NO DROP, TRUNCATE, ALTER statements
- NO CREATE statements (except SELECT ... INTO for result sets)
- NO GRANT, REVOKE, or permission changes
- NO EXECUTE/CALL of stored procedures
- ONLY generate SELECT queries and WITH (CTE) statements that read data

If a user asks for a mutation query, politely explain that you can only generate read-only SELECT queries for safety.

Your responses must ALWAYS be valid JSON with this exact structure:
{
  "sql": "THE SQL QUERY HERE - MUST BE PROPERLY FORMATTED WITH LINE BREAKS",
  "explanation": "A brief explanation of what the query does or what changes were made",
  "changes": ["Change 1", "Change 2"] // Only include if modifying existing SQL
}

SQL FORMATTING REQUIREMENTS - CRITICAL:
The SQL in your response MUST be formatted with proper line breaks for readability:
- Each major clause (SELECT, FROM, WHERE, JOIN, GROUP BY, ORDER BY, LIMIT) on its own line
- Each selected column on its own line (except simple 2-3 column queries)
- AND/OR conditions on separate lines with proper indentation
- Use 2-space indentation for continued lines
- Example:
  SELECT
    "column1",
    "column2",
    COUNT(*) AS total
  FROM "table"
  WHERE "status" = 'active'
    AND "created_at" > NOW() - INTERVAL '7 days'
  GROUP BY "column1", "column2"
  ORDER BY total DESC
  LIMIT 100

CRITICAL PostgreSQL syntax requirements:
1. ALWAYS wrap table and column names in double quotes
2. For schema-qualified tables: "schema_name"."table_name"
3. Use PostgreSQL functions: NOW(), CURRENT_DATE, EXTRACT(), COALESCE(), ILIKE
4. Use :: for type casting (e.g., value::integer)
5. Use PostgreSQL boolean literals: TRUE, FALSE
6. For JSON: use ->, ->>, #>, @> operators
7. Use exact table/column names from schema (with double quotes)
8. Always use table aliases when joining
9. No semicolons at end
10. If requested data doesn't exist, make a best-effort query

PERFORMANCE OPTIMIZATION:
1. Only SELECT needed columns, avoid SELECT *
2. Use INNER JOIN when all rows must match
3. Add LIMIT for exploratory queries (default LIMIT 100)
4. Put selective WHERE conditions first
5. Use EXISTS instead of IN for existence checks
6. Use COUNT(*) when counting all rows
7. Only use DISTINCT when duplicates are possible

${isFollowUp ? `
When modifying an existing query:
- Keep "changes" array concise
- Focus explanation on what changed and why
- Preserve unchanged parts
` : `
When creating a new query:
- Omit the "changes" array
- Explain what the query does
`}

${isDebugMode ? `
DEBUGGING MODE: The previous query returned no rows or had issues. Analyze the query and suggest fixes.
Consider:
- Are the WHERE conditions too restrictive?
- Are JOIN conditions correct?
- For JSON fields, are you using the right operators (-> vs ->>)?
- Are there type mismatches?
` : ''}

IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks.`;
    }

    const messages = buildConversationMessages(
      conversationHistory,
      schemaContext,
      sampleDataContext,
      currentSql,
      queryResultContext,
      prompt
    );

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Failed to generate SQL: No text response from AI' },
        { status: 500 }
      );
    }

    let responseText = textContent.text.trim();

    // Remove markdown code blocks
    if (responseText.startsWith('```json')) {
      responseText = responseText.slice(7);
    } else if (responseText.startsWith('```')) {
      responseText = responseText.slice(3);
    }
    if (responseText.endsWith('```')) {
      responseText = responseText.slice(0, -3);
    }
    responseText = responseText.trim();

    let parsedResponse: AiQueryResponse;
    try {
      parsedResponse = JSON.parse(responseText);
    } catch {
      parsedResponse = {
        sql: responseText,
        explanation: isFollowUp ? 'Query updated based on your request.' : 'Query generated based on your request.',
      };
    }

    // Clean up SQL
    let sql = parsedResponse.sql || '';
    if (sql.startsWith('```sql')) {
      sql = sql.slice(6);
    } else if (sql.startsWith('```')) {
      sql = sql.slice(3);
    }
    if (sql.endsWith('```')) {
      sql = sql.slice(0, -3);
    }
    sql = sql.trim();

    // SAFETY CHECK: Block mutation queries
    if (isMutationQuery(sql)) {
      return NextResponse.json({
        sql: currentSql || '',
        explanation: 'I can only generate read-only SELECT queries for safety. Mutation queries (INSERT, UPDATE, DELETE, DROP, etc.) are not allowed.',
        changes: [],
      });
    }

    // Format SQL for readable diffs
    sql = formatSql(sql);

    return NextResponse.json({
      sql,
      explanation: parsedResponse.explanation || '',
      changes: parsedResponse.changes || [],
      validation: parsedResponse.validation,
      debugInfo: parsedResponse.debugInfo,
    });
  } catch (error: unknown) {
    console.error('AI query generation error:', error);

    let errorMessage = 'Failed to generate query';
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.message.includes('invalid_api_key') || error.message.includes('authentication')) {
        errorMessage = 'Invalid API key. Please check your Claude API key.';
        statusCode = 401;
      } else if (error.message.includes('rate_limit')) {
        errorMessage = 'Rate limit exceeded. Please try again later.';
        statusCode = 429;
      } else if (error.message.includes('overloaded')) {
        errorMessage = 'Claude is currently overloaded. Please try again in a moment.';
        statusCode = 503;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: statusCode }
    );
  }
}
