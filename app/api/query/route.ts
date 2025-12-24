import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';
import { validateSql } from '@/lib/sql-validation';

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

    // Create PostgreSQL client
    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000, // 30 second query timeout
    });

    await client.connect();

    // Execute query
    const startTime = Date.now();
    const result = await client.query(sql);
    const executionTime = Date.now() - startTime;

    // Format response
    const response = {
      rows: result.rows,
      fields: result.fields.map((f) => ({
        name: f.name,
        dataTypeID: f.dataTypeID,
      })),
      rowCount: result.rowCount || 0,
      executionTime,
      warning: validationResult.warning,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Query execution error:', error);

    // Determine error type and return appropriate message
    let errorMessage = 'Query execution failed';
    let statusCode = 500;

    if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Unable to connect to database. Check your connection string and ensure the database is running.';
      statusCode = 503;
    } else if (error.code === '28P01') {
      errorMessage = 'Authentication failed. Check your username and password.';
      statusCode = 401;
    } else if (error.code === '3D000') {
      errorMessage = 'Database does not exist. Check your connection string.';
      statusCode = 404;
    } else if (error.code === '42601') {
      errorMessage = `SQL syntax error: ${error.message}`;
      statusCode = 400;
    } else if (error.code === '42P01') {
      errorMessage = `Table does not exist: ${error.message}`;
      statusCode = 404;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code },
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
