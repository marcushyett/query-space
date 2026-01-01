import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, checkOrganizationAccess } from '@/lib/auth/session';

interface QueryExecutionRecord {
  id: string;
  sql: string;
  queryName: string | null;
  source: string;
  success: boolean;
  error: string | null;
  rowCount: number | null;
  executionTime: number | null;
  agentSessionId: string | null;
  queryId: string | null;
  createdAt: Date;
}

const createExecutionSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  queryId: z.string().optional(),
  sql: z.string().min(1),
  queryName: z.string().optional(),
  source: z.enum(['MANUAL', 'AI']).default('MANUAL'),
  success: z.boolean().default(true),
  error: z.string().optional(),
  rowCount: z.number().optional(),
  executionTime: z.number().optional(),
  agentSessionId: z.string().optional(),
});

const listExecutionsSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  queryId: z.string().optional(),
  agentSessionId: z.string().optional(),
  source: z.enum(['MANUAL', 'AI']).optional(),
  success: z.enum(['true', 'false']).optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(500).default(100),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/query-executions - List query executions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listExecutionsSchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, projectId, queryId, agentSessionId, source, success, search, limit, offset } = parsed.data;

    // Check organization access
    const access = await checkOrganizationAccess(organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    // Build where clause
    const where: {
      organizationId: string;
      projectId?: string;
      queryId?: string;
      agentSessionId?: string;
      source?: 'MANUAL' | 'AI';
      success?: boolean;
      OR?: Array<{ sql?: { contains: string; mode: 'insensitive' }; queryName?: { contains: string; mode: 'insensitive' } }>;
    } = { organizationId };

    if (projectId) where.projectId = projectId;
    if (queryId) where.queryId = queryId;
    if (agentSessionId) where.agentSessionId = agentSessionId;
    if (source) where.source = source;
    if (success !== undefined) where.success = success === 'true';

    if (search) {
      where.OR = [
        { sql: { contains: search, mode: 'insensitive' } },
        { queryName: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [executions, total] = await Promise.all([
      prisma.queryExecution.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.queryExecution.count({ where }),
    ]);

    return NextResponse.json({
      executions: executions.map((e: QueryExecutionRecord) => ({
        id: e.id,
        sql: e.sql,
        queryName: e.queryName,
        source: e.source.toLowerCase(),
        success: e.success,
        error: e.error,
        rowCount: e.rowCount,
        executionTime: e.executionTime,
        agentSessionId: e.agentSessionId,
        queryId: e.queryId,
        createdAt: e.createdAt.getTime(),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List query executions error:', error);
    return NextResponse.json({ error: 'Failed to fetch query executions' }, { status: 500 });
  }
}

// POST /api/query-executions - Record a query execution
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createExecutionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, projectId, queryId, sql, queryName, source, success, error, rowCount, executionTime, agentSessionId } = parsed.data;

    // Check organization access
    const access = await checkOrganizationAccess(organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    const execution = await prisma.queryExecution.create({
      data: {
        organizationId,
        projectId,
        queryId,
        sql,
        queryName,
        source,
        success,
        error,
        rowCount,
        executionTime,
        agentSessionId,
        createdById: user.id,
      },
    });

    return NextResponse.json({
      execution: {
        id: execution.id,
        sql: execution.sql,
        queryName: execution.queryName,
        source: execution.source.toLowerCase(),
        success: execution.success,
        error: execution.error,
        rowCount: execution.rowCount,
        executionTime: execution.executionTime,
        agentSessionId: execution.agentSessionId,
        queryId: execution.queryId,
        createdAt: execution.createdAt.getTime(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create query execution error:', error);
    return NextResponse.json({ error: 'Failed to record query execution' }, { status: 500 });
  }
}
