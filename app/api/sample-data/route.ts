import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SampleDataRequest {
  connectionString: string;
  tables: string[]; // List of table names to sample (format: "schema"."table" or just "table")
  sampleSize?: number; // Number of rows to sample (default 3)
}

interface TableSample {
  table: string;
  columns: string[];
  rows: Record<string, unknown>[];
  jsonFieldSamples?: Record<string, unknown[]>; // Samples of nested JSON structure
}

interface SampleDataResponse {
  samples: TableSample[];
}

// Truncate large values for context
function truncateValue(value: unknown, maxLength: number = 200): unknown {
  if (value === null || value === undefined) return value;

  if (typeof value === 'string') {
    if (value.length > maxLength) {
      return value.substring(0, maxLength) + '...';
    }
    return value;
  }

  if (Array.isArray(value)) {
    // For arrays, show first 3 items and truncate
    const truncated = value.slice(0, 3).map(item => truncateValue(item, maxLength / 2));
    if (value.length > 3) {
      return [...truncated, `... (${value.length - 3} more items)`];
    }
    return truncated;
  }

  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    const truncatedObj: Record<string, unknown> = {};

    // Only include first 5 keys for large objects
    const keysToInclude = keys.slice(0, 5);
    for (const key of keysToInclude) {
      truncatedObj[key] = truncateValue(obj[key], maxLength / 2);
    }

    if (keys.length > 5) {
      truncatedObj['...'] = `(${keys.length - 5} more fields)`;
    }

    return truncatedObj;
  }

  return value;
}

// Sample rows from a table
async function sampleTable(
  client: Client,
  tableName: string,
  sampleSize: number
): Promise<TableSample | null> {
  try {
    // Parse table name (may include schema)
    let schema = 'public';
    let table = tableName;

    // Handle quoted identifiers
    const schemaTableMatch = tableName.match(/^"?([^"]+)"?\."?([^"]+)"?$/);
    if (schemaTableMatch) {
      schema = schemaTableMatch[1];
      table = schemaTableMatch[2];
    } else {
      // Remove quotes if present
      table = tableName.replace(/"/g, '');
    }

    // Get column info to identify JSON columns
    const columnQuery = `
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2
      ORDER BY ordinal_position
    `;
    const columnResult = await client.query(columnQuery, [schema, table]);
    const columns = columnResult.rows.map(r => r.column_name);
    const jsonColumns = columnResult.rows
      .filter(r => r.data_type === 'json' || r.data_type === 'jsonb')
      .map(r => r.column_name);

    // Sample rows
    const sampleQuery = `
      SELECT * FROM "${schema}"."${table}"
      LIMIT ${sampleSize}
    `;
    const sampleResult = await client.query(sampleQuery);

    // Truncate values for context
    const truncatedRows = sampleResult.rows.map(row => {
      const truncatedRow: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(row)) {
        truncatedRow[key] = truncateValue(value);
      }
      return truncatedRow;
    });

    // Extract unique JSON field structures
    const jsonFieldSamples: Record<string, unknown[]> = {};
    for (const jsonCol of jsonColumns) {
      const samples: unknown[] = [];
      for (const row of sampleResult.rows) {
        if (row[jsonCol] && !samples.some(s => JSON.stringify(s) === JSON.stringify(truncateValue(row[jsonCol])))) {
          samples.push(truncateValue(row[jsonCol]));
          if (samples.length >= 2) break; // Only 2 unique samples per JSON column
        }
      }
      if (samples.length > 0) {
        jsonFieldSamples[jsonCol] = samples;
      }
    }

    return {
      table: tableName,
      columns,
      rows: truncatedRows,
      jsonFieldSamples: Object.keys(jsonFieldSamples).length > 0 ? jsonFieldSamples : undefined,
    };
  } catch (error) {
    console.error(`Error sampling table ${tableName}:`, error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  let client: Client | null = null;

  try {
    const body: SampleDataRequest = await request.json();
    const { connectionString, tables, sampleSize = 3 } = body;

    if (!connectionString) {
      return NextResponse.json(
        { error: 'Missing required field: connectionString' },
        { status: 400 }
      );
    }

    if (!tables || tables.length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: tables' },
        { status: 400 }
      );
    }

    client = new Client({
      connectionString,
      connectionTimeoutMillis: 10000,
      query_timeout: 30000,
    });

    await client.connect();

    // Sample each table
    const samples: TableSample[] = [];
    for (const table of tables.slice(0, 10)) { // Limit to 10 tables max
      const sample = await sampleTable(client, table, Math.min(sampleSize, 5));
      if (sample) {
        samples.push(sample);
      }
    }

    return NextResponse.json({ samples } as SampleDataResponse);
  } catch (error: unknown) {
    console.error('Sample data error:', error);

    let errorMessage = 'Failed to sample data';
    if (error instanceof Error) {
      errorMessage = error.message;
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
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
