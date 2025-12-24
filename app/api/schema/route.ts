import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface SchemaColumn {
  name: string;
  type: string;
  isPrimaryKey: boolean;
}

export interface SchemaTable {
  schema: string;
  name: string;
  type: 'table' | 'view';
  columns: SchemaColumn[];
}

export interface SchemaResponse {
  tables: SchemaTable[];
}

// Query to fetch all tables and views with their columns
const SCHEMA_QUERY = `
  WITH table_columns AS (
    SELECT
      c.table_schema,
      c.table_name,
      c.column_name,
      c.data_type,
      COALESCE(
        (SELECT true FROM information_schema.table_constraints tc
         JOIN information_schema.key_column_usage kcu
           ON tc.constraint_name = kcu.constraint_name
           AND tc.table_schema = kcu.table_schema
         WHERE tc.constraint_type = 'PRIMARY KEY'
           AND tc.table_schema = c.table_schema
           AND tc.table_name = c.table_name
           AND kcu.column_name = c.column_name),
        false
      ) as is_primary_key,
      c.ordinal_position
    FROM information_schema.columns c
    WHERE c.table_schema NOT IN ('pg_catalog', 'information_schema')
  )
  SELECT
    t.table_schema as schema,
    t.table_name as name,
    t.table_type as type,
    COALESCE(
      json_agg(
        json_build_object(
          'name', tc.column_name,
          'type', tc.data_type,
          'isPrimaryKey', tc.is_primary_key
        )
        ORDER BY tc.ordinal_position
      ) FILTER (WHERE tc.column_name IS NOT NULL),
      '[]'::json
    ) as columns
  FROM information_schema.tables t
  LEFT JOIN table_columns tc
    ON tc.table_schema = t.table_schema
    AND tc.table_name = t.table_name
  WHERE t.table_schema NOT IN ('pg_catalog', 'information_schema')
    AND t.table_type IN ('BASE TABLE', 'VIEW')
  GROUP BY t.table_schema, t.table_name, t.table_type
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

    const result = await client.query(SCHEMA_QUERY);

    const tables: SchemaTable[] = result.rows.map((row) => ({
      schema: row.schema,
      name: row.name,
      type: row.type === 'VIEW' ? 'view' : 'table',
      columns: row.columns || [],
    }));

    return NextResponse.json({ tables } as SchemaResponse);
  } catch (error: unknown) {
    console.error('Schema fetch error:', error);

    let errorMessage = 'Failed to fetch schema';
    let statusCode = 500;
    let errorCode: string | undefined;

    if (error instanceof Error && 'code' in error) {
      const dbError = error as Error & { code: string };
      errorCode = dbError.code;

      if (dbError.code === 'ECONNREFUSED') {
        errorMessage = 'Unable to connect to database.';
        statusCode = 503;
      } else if (dbError.code === '28P01') {
        errorMessage = 'Authentication failed.';
        statusCode = 401;
      } else if (dbError.code === '3D000') {
        errorMessage = 'Database does not exist.';
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
