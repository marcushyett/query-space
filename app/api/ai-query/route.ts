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
  // For clarification and goal confirmation
  clarifyingQuestions?: string[];
  goalSummary?: string;
  needsClarification?: boolean;
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

function isValidSelectQuery(sql: string): { valid: boolean; reason?: string } {
  if (!sql || typeof sql !== 'string') {
    return { valid: false, reason: 'No SQL provided' };
  }

  const trimmed = sql.trim();

  // Check if it starts with SELECT or WITH (CTE)
  const upperTrimmed = trimmed.toUpperCase();
  if (!upperTrimmed.startsWith('SELECT') && !upperTrimmed.startsWith('WITH')) {
    return { valid: false, reason: 'SQL must start with SELECT or WITH' };
  }

  // Check for basic SQL structure - must have FROM clause (except for simple expressions)
  // Allow queries like "SELECT 1" or "SELECT NOW()" without FROM
  const hasFrom = /\bFROM\b/i.test(trimmed);
  const isSimpleExpression = /^(SELECT|WITH)\s+[\w\d\s(),*'":.+-]+$/i.test(trimmed);

  if (!hasFrom && !isSimpleExpression) {
    return { valid: false, reason: 'SQL appears to be malformed - missing FROM clause' };
  }

  // Check that it's not just the user's prompt repeated back
  // Natural language typically has more spaces between words and lacks SQL keywords in proper positions
  const sqlKeywords = ['SELECT', 'FROM', 'WHERE', 'JOIN', 'GROUP BY', 'ORDER BY', 'LIMIT', 'WITH', 'AS'];
  const keywordCount = sqlKeywords.filter(kw => upperTrimmed.includes(kw)).length;

  if (keywordCount < 2 && !isSimpleExpression) {
    return { valid: false, reason: 'SQL lacks sufficient SQL keywords' };
  }

  return { valid: true };
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
      systemPrompt = `You are a PostgreSQL query validator and fixer. Analyze the query results and determine if they are sensible.

Your response must be valid JSON:
{
  "sql": "THE FIXED SQL QUERY if issues found, or original SQL if valid",
  "explanation": "Brief analysis of the results and what was fixed (if anything)",
  "validation": {
    "isValid": true/false,
    "issues": ["Issue 1", "Issue 2"], // Only if problems found
    "suggestions": ["Suggestion 1"] // Optional improvements
  }
}

Check for these issues:
- All columns returning NULL values (may indicate wrong JSON path or field name)
- Data that seems malformed or inconsistent
- Missing expected data patterns

IMPORTANT: If you find issues that can be fixed:
1. Set isValid to false
2. List the issues found
3. Return a CORRECTED SQL query in the "sql" field that fixes these issues
4. The fixed SQL must be properly formatted with line breaks

If results look valid, set isValid to true and return the original SQL unchanged.

Be helpful but don't be overly critical of valid results. Focus on serious data quality issues like empty columns.

IMPORTANT: Return ONLY valid JSON, no markdown. NEVER generate mutation queries.`;
    } else if (mode === 'debug') {
      systemPrompt = `You are a PostgreSQL query debugger. Diagnose why a query returned no rows or unexpected results.

Your response must be valid JSON:
{
  "sql": "Corrected SQL query or diagnostic query - MUST BE VALID SELECT QUERY",
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

JSON FIELD EXPLORATION STRATEGY:
When dealing with JSON fields that return no results:
1. First, try to discover what keys actually exist in the JSON:
   - SELECT DISTINCT jsonb_object_keys("json_column") FROM "table" LIMIT 50
2. Try similar field name variations:
   - camelCase vs snake_case (e.g., "userId" vs "user_id")
   - With/without underscores
   - Singular vs plural
   - Different abbreviations (e.g., "desc" vs "description")
3. Check if the field is nested deeper:
   - "data"->'nested'->'field' instead of "data"->'field'
4. Sample rows that have non-null values in the JSON field:
   - SELECT "json_column" FROM "table" WHERE "json_column" IS NOT NULL LIMIT 5
5. Use jsonb_path_query or recursive exploration for deep nesting
6. Use COALESCE to try multiple possible paths

If you need to explore the data to diagnose, set needsMoreData to true and provide diagnostic queries that explore the JSON structure.

IMPORTANT: Return ONLY valid JSON, no markdown. The SQL must be a valid SELECT query. NEVER generate INSERT, UPDATE, DELETE, DROP, or any mutation queries.`;
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

CRITICAL: ALWAYS GENERATE VALID SQL
- Your "sql" field MUST contain a valid PostgreSQL SELECT query
- NEVER output the user's request/prompt as the SQL
- NEVER output natural language as SQL
- If the request is unclear, EXPLORE THE DATA to understand what's available before asking questions
- If the data doesn't exist, still generate a valid query that attempts to find similar data

Your responses must ALWAYS be valid JSON with this exact structure:
{
  "sql": "THE SQL QUERY HERE - MUST BE A VALID SELECT QUERY WITH PROPER FORMATTING",
  "explanation": "A brief explanation of what the query does or what changes were made",
  "changes": ["Change 1", "Change 2"], // Only include if modifying existing SQL
  "goalSummary": "Internal note of what you understand the user wants (not shown to user)",
  "clarifyingQuestions": ["Question 1?", "Question 2?"], // ONLY if truly needed - explore data first!
  "needsClarification": true/false // Set to true ONLY if you cannot proceed even after data exploration
}

UNDERSTANDING USER INTENT:
1. Before generating a query, understand what the user is trying to accomplish
2. For internal tracking, include a "goalSummary" that restates what you understand they want (this is not shown to the user)
3. EXPLORE DATA FIRST - Do NOT ask for clarification unless absolutely necessary:
   - If a request mentions data that might exist, TRY to find it first
   - Generate exploratory queries to discover available columns and JSON keys
   - If a column isn't found immediately, analyze JSON fields using jsonb_object_keys()
   - Only ask for clarification if the request is completely incomprehensible OR if you've confirmed the data doesn't exist after exploration
4. AVOID asking about:
   - Specific fields/columns - explore the schema and JSON structures instead
   - Time ranges - use reasonable defaults (e.g., last 30 days) or return all data
   - Aggregation preferences - make a sensible choice based on context
   - Specific filter values - either include all or make reasonable assumptions
5. WHEN TO ASK FOR CLARIFICATION (only these cases):
   - The request is so vague you cannot determine ANY intent (e.g., just "data" or "stuff")
   - You've explored the data and confirmed the requested information truly doesn't exist
   - There are multiple completely different interpretations with no way to choose

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
10. If requested data doesn't exist, make a best-effort query with available fields

JSON FIELD HANDLING - CRITICAL FOR DATA EXPLORATION:
1. JSON fields often have inconsistent schemas - not every row may have the same structure
2. ALWAYS EXPLORE JSON STRUCTURE BEFORE ASKING FOR CLARIFICATION:
   - When a requested column/field is not in the schema, CHECK JSON FIELDS FIRST
   - Use jsonb_object_keys() to discover what keys exist: SELECT DISTINCT jsonb_object_keys("json_column") FROM "table" LIMIT 100
   - Sample actual JSON values: SELECT "json_column" FROM "table" WHERE "json_column" IS NOT NULL LIMIT 5
   - The data the user wants is often inside a JSON field with a different name
3. When looking for a sub-field in JSON, if initial attempts fail:
   - Try variations of field names (camelCase, snake_case, different spellings)
   - Check nested paths: "data"->'nested'->'field' instead of "data"->'field'
   - Use COALESCE with multiple possible paths
4. Always use COALESCE for JSON extractions to handle missing data gracefully
5. Generate exploratory queries rather than asking what the user wants - DISCOVER the data yourself
6. Example exploration approach:
   - First: SELECT DISTINCT jsonb_object_keys("data") FROM "table" LIMIT 100
   - Then: SELECT "data"->>'discovered_key' FROM "table" LIMIT 10
   - For nested: SELECT DISTINCT jsonb_object_keys("data"->'nested_obj') FROM "table" LIMIT 100

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
- Include goalSummary to confirm understanding
- Explain what the query does
`}

${isDebugMode ? `
DEBUGGING MODE: The previous query returned no rows or had issues. Analyze the query and suggest fixes.
Consider:
- Are the WHERE conditions too restrictive?
- Are JOIN conditions correct?
- For JSON fields, are you using the right operators (-> vs ->>)?
- Are there type mismatches?
- For JSON fields that might not exist in every row, try exploring similar field names
` : ''}

IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks. The SQL must start with SELECT or WITH.`;
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
      model: 'claude-haiku-4-5-20251001',
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

    // VALIDATION CHECK: Ensure we have a valid SQL query, not just a prompt
    const sqlValidation = isValidSelectQuery(sql);
    if (!sqlValidation.valid && !parsedResponse.needsClarification) {
      // If the SQL is invalid and we're not asking for clarification,
      // return an error and ask the user to clarify
      return NextResponse.json({
        sql: currentSql || '',
        explanation: `I couldn't generate a valid SQL query. ${sqlValidation.reason || 'Please provide more details about what data you want to query.'}`,
        needsClarification: true,
        clarifyingQuestions: [
          'What specific data or table are you trying to query?',
          'What columns or fields would you like to see?',
          'Are there any specific filters or conditions you want to apply?',
        ],
      });
    }

    // Format SQL for readable diffs (only if we have valid SQL)
    if (sqlValidation.valid) {
      sql = formatSql(sql);
    }

    return NextResponse.json({
      sql,
      explanation: parsedResponse.explanation || '',
      changes: parsedResponse.changes || [],
      validation: parsedResponse.validation,
      debugInfo: parsedResponse.debugInfo,
      clarifyingQuestions: parsedResponse.clarifyingQuestions,
      goalSummary: parsedResponse.goalSummary,
      needsClarification: parsedResponse.needsClarification,
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
