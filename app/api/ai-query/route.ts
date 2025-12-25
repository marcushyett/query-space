import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import type { SchemaTable } from '@/app/api/schema/route';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface AiQueryRequest {
  prompt: string;
  apiKey: string;
  schema: SchemaTable[];
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

export async function POST(request: NextRequest) {
  try {
    const body: AiQueryRequest = await request.json();
    const { prompt, apiKey, schema } = body;

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

    // Create Anthropic client
    const anthropic = new Anthropic({
      apiKey: effectiveApiKey,
    });

    // Generate SQL using Claude
    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      messages: [
        {
          role: 'user',
          content: `You are a PostgreSQL SQL expert. Generate a valid PostgreSQL query based on the user's request.

${schemaContext}

User request: ${prompt.trim()}

CRITICAL PostgreSQL syntax requirements:
1. Return ONLY the SQL query, no explanations or markdown formatting
2. ALWAYS wrap table and column names in double quotes (e.g., SELECT "column_name" FROM "table_name")
3. For schema-qualified tables, use: "schema_name"."table_name"
4. Use PostgreSQL-specific functions:
   - NOW() for current timestamp
   - CURRENT_DATE for current date
   - EXTRACT(field FROM date) for date parts
   - COALESCE() for null handling
   - CONCAT() or || operator for string concatenation
   - ILIKE for case-insensitive pattern matching
   - LIMIT and OFFSET for pagination (not TOP)
5. Use PostgreSQL type casting with :: operator (e.g., value::integer, value::text)
6. Use PostgreSQL boolean literals: TRUE, FALSE (not 1, 0)
7. For JSON operations, use PostgreSQL operators: ->, ->>, #>, @>, etc.
8. Use the exact table and column names from the schema above (with double quotes)
9. Always use table aliases when joining tables
10. Do not include semicolons at the end of the query
11. If the schema doesn't have the requested tables or columns, return a best-effort query with a SQL comment explaining the assumption

SQL query:`,
        },
      ],
    });

    // Extract the text content from the response
    const textContent = message.content.find((block) => block.type === 'text');
    if (!textContent || textContent.type !== 'text') {
      return NextResponse.json(
        { error: 'Failed to generate SQL: No text response from AI' },
        { status: 500 }
      );
    }

    // Clean up the SQL response
    let sql = textContent.text.trim();

    // Remove markdown code blocks if present
    if (sql.startsWith('```sql')) {
      sql = sql.slice(6);
    } else if (sql.startsWith('```')) {
      sql = sql.slice(3);
    }
    if (sql.endsWith('```')) {
      sql = sql.slice(0, -3);
    }
    sql = sql.trim();

    return NextResponse.json({ sql });
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
