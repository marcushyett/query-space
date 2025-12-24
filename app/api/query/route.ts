import { NextRequest, NextResponse } from 'next/server';
import { Client, FieldDef } from 'pg';
import { validateSql } from '@/lib/sql-validation';
import { addDefaultLimit } from '@/lib/sql-limit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  let client: Client | null = null;

  try {
    const { connectionString, sql } = await request.json();

    // Validate inputs
    if (!connectionString || !sql) {
      return NextResponse.json(
        { error: 'Missing required fields: connectionString and sql' },
        { status: 400 }
      );
    }

    // Basic SQL validation
    const validationResult = validateSql(sql);
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: validationResult.error },
        { status: 400 }
      );
    }

    // Add default LIMIT if not present (for SELECT queries)
    const { sql: queryToExecute, limitAdded } = addDefaultLimit(sql);

    // Create PostgreSQL client
    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000, // 30 second query timeout
    });

    await client.connect();

    // Execute query
    const startTime = Date.now();
    const result = await client.query(queryToExecute);
    const executionTime = Date.now() - startTime;

    // Combine warnings
    let warning = validationResult.warning;
    if (limitAdded) {
      const limitWarning = 'Results limited to 1000 rows. Add your own LIMIT clause to override.';
      warning = warning ? `${warning}; ${limitWarning}` : limitWarning;
    }

    // Format response
    const response = {
      rows: result.rows,
      fields: result.fields.map((f: FieldDef) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
      rowCount: result.rowCount || 0,
      executionTime,
      warning,
      limitAdded,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    console.error('Query execution error:', error);

    // Determine error type and return appropriate message
    let errorMessage = 'Query execution failed';
    let statusCode = 500;
    let errorCode: string | undefined;

    if (error instanceof Error && 'code' in error) {
      const dbError = error as Error & { code: string };
      errorCode = dbError.code;

      if (dbError.code === 'ECONNREFUSED') {
        errorMessage = 'Unable to connect to database. Check your connection string and ensure the database is running.';
        statusCode = 503;
      } else if (dbError.code === '28P01') {
        errorMessage = 'Authentication failed. Check your username and password.';
        statusCode = 401;
      } else if (dbError.code === '3D000') {
        errorMessage = 'Database does not exist. Check your connection string.';
        statusCode = 404;
      } else if (dbError.code === '42601') {
        errorMessage = `SQL syntax error: ${dbError.message}`;
        statusCode = 400;
      } else if (dbError.code === '42P01') {
        errorMessage = `Table does not exist: ${dbError.message}`;
        statusCode = 404;
      } else {
        errorMessage = dbError.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, code: errorCode },
      { status: statusCode }
    );
  } finally {
    // Always close the connection
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
  }
}
