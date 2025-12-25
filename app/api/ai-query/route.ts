import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SchemaTable } from '@/app/api/schema/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AiQueryRequest {
  prompt: string;
  apiKey: string;
  schema: SchemaTable[];
  conversationHistory?: ConversationMessage[];
  currentSql?: string;
}

interface AiQueryResponse {
  sql: string;
  explanation: string;
  changes?: string[];
}

function formatSchemaForPrompt(schema: SchemaTable[]): string {
  if (!schema || schema.length === 0) {
    return 'No schema information available.';
  }

  const lines: string[] = ['Database Schema (PostgreSQL):', ''];

  for (const table of schema) {
    // Format with double quotes for PostgreSQL identifiers
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
        // Show columns with double quotes too
        lines.push(`  - "${column.name}": ${column.type}${pkIndicator}`);
      }
    }
    lines.push('');
  }

  return lines.join('\n');
}

function buildConversationMessages(
  conversationHistory: ConversationMessage[],
  schemaContext: string,
  currentSql: string | undefined,
  newPrompt: string
): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = [];

  // Add conversation history
  for (const msg of conversationHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // Build the new user message with context
  let userMessage = '';

  // If this is the first message, include schema context
  if (conversationHistory.length === 0) {
    userMessage = `${schemaContext}\n\n`;
  }

  // Include current SQL if it exists and we're in a multi-turn conversation
  if (currentSql && conversationHistory.length > 0) {
    userMessage += `Current SQL query:\n\`\`\`sql\n${currentSql}\n\`\`\`\n\n`;
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
    const { prompt, apiKey, schema, conversationHistory = [], currentSql } = body;

    // Validate inputs
    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    // Use provided API key or fall back to environment variable
    const effectiveApiKey = apiKey || process.env.CLAUDE_API_KEY;

    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'API key is required. Please provide your Claude API key.' },
        { status: 400 }
      );
    }

    // Format schema for the prompt
    const schemaContext = formatSchemaForPrompt(schema || []);

    // Determine if this is a follow-up message
    const isFollowUp = conversationHistory.length > 0;

    // Create Anthropic client
    const anthropic = new Anthropic({
      apiKey: effectiveApiKey,
    });

    // Build system prompt
    const systemPrompt = `You are a PostgreSQL SQL expert assistant helping users build and refine queries through conversation.

Your responses must ALWAYS be valid JSON with this exact structure:
{
  "sql": "THE SQL QUERY HERE",
  "explanation": "A brief explanation of what the query does or what changes were made",
  "changes": ["Change 1", "Change 2"] // Only include if modifying existing SQL
}

CRITICAL PostgreSQL syntax requirements:
1. ALWAYS wrap table and column names in double quotes (e.g., SELECT "column_name" FROM "table_name")
2. For schema-qualified tables, use: "schema_name"."table_name"
3. Use PostgreSQL-specific functions:
   - NOW() for current timestamp
   - CURRENT_DATE for current date
   - EXTRACT(field FROM date) for date parts
   - COALESCE() for null handling
   - CONCAT() or || operator for string concatenation
   - ILIKE for case-insensitive pattern matching
   - LIMIT and OFFSET for pagination (not TOP)
4. Use PostgreSQL type casting with :: operator (e.g., value::integer, value::text)
5. Use PostgreSQL boolean literals: TRUE, FALSE (not 1, 0)
6. For JSON operations, use PostgreSQL operators: ->, ->>, #>, @>, etc.
7. Use the exact table and column names from the schema (with double quotes)
8. Always use table aliases when joining tables
9. Do not include semicolons at the end of the query
10. If the schema doesn't have the requested tables or columns, make a best-effort query

${isFollowUp ? `
When modifying an existing query:
- Keep the "changes" array concise - list specific modifications made
- The explanation should focus on what was changed and why
- Preserve parts of the query that weren't requested to change
` : `
When creating a new query:
- Omit the "changes" array
- The explanation should describe what the query does
`}

IMPORTANT: Return ONLY valid JSON, no markdown formatting or code blocks.`;

    // Build conversation messages
    const messages = buildConversationMessages(
      conversationHistory,
      schemaContext,
      currentSql,
      prompt
    );

    // Generate SQL using Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2048,
      system: systemPrompt,
      messages,
    });

    // Extract the text content from the response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Failed to generate SQL: No text response from AI' },
        { status: 500 }
      );
    }

    // Parse the JSON response
    let responseText = textContent.text.trim();

    // Remove markdown code blocks if present
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
      // Fallback: treat the entire response as SQL
      parsedResponse = {
        sql: responseText,
        explanation: isFollowUp ? 'Query updated based on your request.' : 'Query generated based on your request.',
      };
    }

    // Clean up SQL if needed
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

    return NextResponse.json({
      sql,
      explanation: parsedResponse.explanation || '',
      changes: parsedResponse.changes || [],
    });
  } catch (error: unknown) {
    console.error('AI query generation error:', error);

    let errorMessage = 'Failed to generate query';
    let statusCode = 500;

    if (error instanceof Error) {
      // Handle Anthropic API errors
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
