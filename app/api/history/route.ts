import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, checkOrganizationAccess } from '@/lib/auth/session';

const listHistorySchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(200).default(100),
  offset: z.coerce.number().min(0).default(0),
});

export interface HistoryItem {
  type: 'query' | 'execution' | 'session';
  id: string;
  timestamp: number;
  // Query fields
  queryId?: string;
  queryName?: string;
  sql?: string;
  projectId?: string;
  projectName?: string;
  // Execution fields (for type: 'execution')
  source?: 'manual' | 'ai';
  success?: boolean;
  error?: string;
  rowCount?: number;
  executionTime?: number;
  // Session fields (for type: 'session')
  goal?: string;
  status?: 'running' | 'paused' | 'completed' | 'failed';
  sessionId?: string;
  queryCount?: number;
}

/**
 * GET /api/history - Get unified history of queries, executions, and AI sessions
 *
 * Returns a combined list of:
 * - Queries (with their associated executions and sessions)
 * - Standalone executions (not linked to a query)
 * - AI sessions (with their query association if any)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listHistorySchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, projectId, search, limit, offset } = parsed.data;

    // Check organization access
    const access = await checkOrganizationAccess(organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    // Fetch queries with their executions and sessions
    const queries = await prisma.query.findMany({
      where: {
        project: {
          organizationId,
          ...(projectId ? { id: projectId } : {}),
        },
        ...(search ? {
          OR: [
            { name: { contains: search, mode: 'insensitive' } },
            { sql: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      include: {
        project: {
          select: { id: true, title: true },
        },
        queryExecutions: {
          orderBy: { createdAt: 'desc' },
          take: 10, // Last 10 executions per query
        },
        agentSessions: {
          orderBy: { updatedAt: 'desc' },
          include: {
            _count: { select: { queryExecutions: true } },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: limit,
      skip: offset,
    });

    // Fetch standalone executions (not linked to a query)
    const standaloneExecutions = await prisma.queryExecution.findMany({
      where: {
        organizationId,
        queryId: null,
        ...(projectId ? { projectId } : {}),
        ...(search ? {
          OR: [
            { sql: { contains: search, mode: 'insensitive' } },
            { queryName: { contains: search, mode: 'insensitive' } },
          ],
        } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    // Fetch standalone sessions (not linked to a query)
    const standaloneSessions = await prisma.agentSession.findMany({
      where: {
        organizationId,
        queryId: null,
        ...(projectId ? { projectId } : {}),
        ...(search ? { goal: { contains: search, mode: 'insensitive' } } : {}),
      },
      include: {
        _count: { select: { queryExecutions: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    });

    // Build unified history items
    const historyItems: HistoryItem[] = [];

    // Add queries with their children
    for (const query of queries) {
      // Add the query itself
      historyItems.push({
        type: 'query',
        id: query.id,
        queryId: query.id,
        queryName: query.name || 'Untitled Query',
        sql: query.sql,
        projectId: query.project.id,
        projectName: query.project.title,
        timestamp: query.updatedAt.getTime(),
      });

      // Add executions under this query
      for (const exec of query.queryExecutions) {
        historyItems.push({
          type: 'execution',
          id: exec.id,
          queryId: query.id,
          queryName: exec.queryName || query.name || undefined,
          sql: exec.sql,
          source: exec.source.toLowerCase() as 'manual' | 'ai',
          success: exec.success,
          error: exec.error || undefined,
          rowCount: exec.rowCount || undefined,
          executionTime: exec.executionTime || undefined,
          timestamp: exec.createdAt.getTime(),
          projectId: query.project.id,
          projectName: query.project.title,
        });
      }

      // Add sessions under this query
      for (const session of query.agentSessions) {
        historyItems.push({
          type: 'session',
          id: session.id,
          sessionId: session.id,
          queryId: query.id,
          queryName: session.queryName || query.name || undefined,
          goal: session.goal,
          status: session.status.toLowerCase() as 'running' | 'paused' | 'completed' | 'failed',
          queryCount: session._count.queryExecutions,
          timestamp: session.updatedAt.getTime(),
          projectId: query.project.id,
          projectName: query.project.title,
        });
      }
    }

    // Add standalone executions
    for (const exec of standaloneExecutions) {
      historyItems.push({
        type: 'execution',
        id: exec.id,
        queryName: exec.queryName || undefined,
        sql: exec.sql,
        source: exec.source.toLowerCase() as 'manual' | 'ai',
        success: exec.success,
        error: exec.error || undefined,
        rowCount: exec.rowCount || undefined,
        executionTime: exec.executionTime || undefined,
        timestamp: exec.createdAt.getTime(),
      });
    }

    // Add standalone sessions
    for (const session of standaloneSessions) {
      historyItems.push({
        type: 'session',
        id: session.id,
        sessionId: session.id,
        goal: session.goal,
        status: session.status.toLowerCase() as 'running' | 'paused' | 'completed' | 'failed',
        queryCount: session._count.queryExecutions,
        timestamp: session.updatedAt.getTime(),
      });
    }

    // Sort all items by timestamp descending
    historyItems.sort((a, b) => b.timestamp - a.timestamp);

    // Get total counts
    const [totalQueries, totalExecutions, totalSessions] = await Promise.all([
      prisma.query.count({
        where: {
          project: {
            organizationId,
            ...(projectId ? { id: projectId } : {}),
          },
        },
      }),
      prisma.queryExecution.count({
        where: {
          organizationId,
          ...(projectId ? { projectId } : {}),
        },
      }),
      prisma.agentSession.count({
        where: {
          organizationId,
          ...(projectId ? { projectId } : {}),
        },
      }),
    ]);

    return NextResponse.json({
      items: historyItems,
      counts: {
        queries: totalQueries,
        executions: totalExecutions,
        sessions: totalSessions,
      },
      limit,
      offset,
    });
  } catch (error) {
    console.error('List history error:', error);
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 });
  }
}
