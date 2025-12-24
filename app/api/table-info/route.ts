import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export interface ColumnInfo {
  name: string;
  type: string;
  nullable: boolean;
  defaultValue: string | null;
  isPrimaryKey: boolean;
  isForeignKey: boolean;
  references: string | null;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  isUnique: boolean;
  isPrimary: boolean;
}

export interface TableInfoResponse {
  schema: string;
  name: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  sampleData: Record<string, unknown>[];
  rowCount: number | null;
}

const COLUMNS_QUERY = `
  SELECT
    c.column_name as name,
    c.data_type as type,
    c.is_nullable = 'YES' as nullable,
    c.column_default as default_value,
    COALESCE(
      (SELECT true FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'PRIMARY KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2
         AND kcu.column_name = c.column_name),
      false
    ) as is_primary_key,
    COALESCE(
      (SELECT true FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY'
         AND tc.table_schema = $1
         AND tc.table_name = $2
         AND kcu.column_name = c.column_name),
      false
    ) as is_foreign_key,
    (SELECT ccu.table_schema || '.' || ccu.table_name || '(' || ccu.column_name || ')'
     FROM information_schema.table_constraints tc
     JOIN information_schema.key_column_usage kcu
       ON tc.constraint_name = kcu.constraint_name
       AND tc.table_schema = kcu.table_schema
     JOIN information_schema.constraint_column_usage ccu
       ON tc.constraint_name = ccu.constraint_name
       AND tc.table_schema = ccu.table_schema
     WHERE tc.constraint_type = 'FOREIGN KEY'
       AND tc.table_schema = $1
       AND tc.table_name = $2
       AND kcu.column_name = c.column_name
     LIMIT 1
    ) as references
  FROM information_schema.columns c
  WHERE c.table_schema = $1 AND c.table_name = $2
  ORDER BY c.ordinal_position
`;

const INDEXES_QUERY = `
  SELECT
    i.relname as name,
    array_agg(a.attname ORDER BY array_position(ix.indkey, a.attnum)) as columns,
    ix.indisunique as is_unique,
    ix.indisprimary as is_primary
  FROM pg_index ix
  JOIN pg_class i ON i.oid = ix.indexrelid
  JOIN pg_class t ON t.oid = ix.indrelid
  JOIN pg_namespace n ON n.oid = t.relnamespace
  JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(ix.indkey)
  WHERE n.nspname = $1 AND t.relname = $2
  GROUP BY i.relname, ix.indisunique, ix.indisprimary
  ORDER BY i.relname
`;

const ROW_COUNT_QUERY = `
  SELECT reltuples::bigint as count
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE c.relname = $2 AND n.nspname = $1
`;

export async function POST(request: NextRequest) {
  let client: Client | null = null;
  let schema: string | undefined;
  let table: string | undefined;

  try {
    const body = await request.json();
    const connectionString = body.connectionString;
    schema = body.schema;
    table = body.table;

    if (!connectionString || !schema || !table) {
      return NextResponse.json(
        { error: 'Missing required fields: connectionString, schema, and table' },
        { status: 400 }
      );
    }

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    await client.connect();

    // Fetch columns, indexes, sample data, and row count in parallel
    const [columnsResult, indexesResult, sampleResult, countResult] = await Promise.all([
      client.query(COLUMNS_QUERY, [schema, table]),
      client.query(INDEXES_QUERY, [schema, table]),
      client.query(`SELECT * FROM "${schema}"."${table}" LIMIT 10`),
      client.query(ROW_COUNT_QUERY, [schema, table]),
    ]);

    const columns: ColumnInfo[] = columnsResult.rows.map((row) => ({
      name: row.name,
      type: row.type,
      nullable: row.nullable,
      defaultValue: row.default_value,
      isPrimaryKey: row.is_primary_key,
      isForeignKey: row.is_foreign_key,
      references: row.references,
    }));

    const indexes: IndexInfo[] = indexesResult.rows.map((row) => ({
      name: row.name,
      columns: row.columns,
      isUnique: row.is_unique,
      isPrimary: row.is_primary,
    }));

    const response: TableInfoResponse = {
      schema,
      name: table,
      columns,
      indexes,
      sampleData: sampleResult.rows,
      rowCount: countResult.rows[0]?.count ? Number(countResult.rows[0].count) : null,
    };

    return NextResponse.json(response);
  } catch (error: any) {
    console.error('Table info fetch error:', error);

    let errorMessage = 'Failed to fetch table information';
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
    } else if (error.code === '42P01') {
      errorMessage = `Table "${table ?? 'unknown'}" does not exist in schema "${schema ?? 'unknown'}".`;
      statusCode = 404;
    } else if (error.message) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage, code: error.code },
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
