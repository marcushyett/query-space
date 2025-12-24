import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface TableInfo {
  schema: string;
  name: string;
  type: 'table' | 'view';
  rowCount: number | null;
}

export interface TablesResponse {
  tables: TableInfo[];
}

const TABLES_QUERY = `
  SELECT
    t.table_schema as schema,
    t.table_name as name,
    t.table_type as type,
    (
      SELECT reltuples::bigint
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relname = t.table_name
        AND n.nspname = t.table_schema
    ) as row_count
  FROM information_schema.tables t
  WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
    AND t.table_type IN ('BASE TABLE', 'VIEW')
  ORDER BY t.table_schema, t.table_name
`;

export async function POST(request: NextRequest) {
  let client: Client | null = null;

  try {
    const { connectionString } = await request.json();

    if (!connectionString) {
      return NextResponse.json(
        { error: 'Missing required field: connectionString' },
        { status: 400 }
      );
    }

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    await client.connect();

    const result = await client.query(TABLES_QUERY);

    const tables: TableInfo[] = result.rows.map((row) => ({
      schema: row.schema,
      name: row.name,
      type: row.type === 'VIEW' ? 'view' : 'table',
      rowCount: row.row_count ? Number(row.row_count) : null,
    }));

    return NextResponse.json({ tables } as TablesResponse);
  } catch (error: unknown) {
    console.error('Tables fetch error:', error);

    let errorMessage = 'Failed to fetch tables';
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
    if (client) {
      try {
        await client.end();
      } catch (e) {
        console.error('Error closing connection:', e);
      }
    }
  }
}
