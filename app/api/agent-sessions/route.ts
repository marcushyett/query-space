import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, checkOrganizationAccess } from '@/lib/auth/session';

interface AgentSessionRecord {
  id: string;
  goal: string;
  status: string;
  currentStep: number;
  maxSteps: number;
  toolCalls: unknown;
  todos: unknown;
  currentSql: string | null;
  previousSql: string | null;
  lastStreamingText: string | null;
  lastError: string | null;
  resumptionContext: string | null;
  chatHistory: unknown;
  queryName: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count: { queryExecutions: number };
}

const createSessionSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  goal: z.string().min(1),
  previousSql: z.string().optional(),
});

const listSessionsSchema = z.object({
  organizationId: z.string(),
  projectId: z.string().optional(),
  status: z.enum(['RUNNING', 'PAUSED', 'COMPLETED', 'FAILED']).optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0),
});

// GET /api/agent-sessions - List agent sessions
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = Object.fromEntries(request.nextUrl.searchParams);
    const parsed = listSessionsSchema.safeParse(searchParams);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, projectId, status, limit, offset } = parsed.data;

    // Check organization access
    const access = await checkOrganizationAccess(organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    // Build where clause
    const where: {
      organizationId: string;
      projectId?: string;
      status?: 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'FAILED';
    } = { organizationId };

    if (projectId) where.projectId = projectId;
    if (status) where.status = status;

    const [sessions, total] = await Promise.all([
      prisma.agentSession.findMany({
        where,
        include: {
          _count: {
            select: { queryExecutions: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      prisma.agentSession.count({ where }),
    ]);

    return NextResponse.json({
      sessions: sessions.map((s: AgentSessionRecord) => ({
        id: s.id,
        goal: s.goal,
        status: s.status.toLowerCase(),
        currentStep: s.currentStep,
        maxSteps: s.maxSteps,
        toolCalls: s.toolCalls,
        todos: s.todos,
        currentSql: s.currentSql,
        previousSql: s.previousSql,
        lastStreamingText: s.lastStreamingText,
        lastError: s.lastError,
        resumptionContext: s.resumptionContext,
        chatHistory: s.chatHistory,
        queryName: s.queryName,
        queryCount: s._count.queryExecutions,
        createdAt: s.createdAt.getTime(),
        updatedAt: s.updatedAt.getTime(),
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    console.error('List agent sessions error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent sessions' }, { status: 500 });
  }
}

// POST /api/agent-sessions - Create a new agent session
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const { organizationId, projectId, goal, previousSql } = parsed.data;

    // Check organization access
    const access = await checkOrganizationAccess(organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Organization access denied' }, { status: 403 });
    }

    const session = await prisma.agentSession.create({
      data: {
        organizationId,
        projectId,
        goal,
        previousSql,
        currentSql: previousSql,
        status: 'RUNNING',
        createdById: user.id,
      },
    });

    return NextResponse.json({
      session: {
        id: session.id,
        goal: session.goal,
        status: session.status.toLowerCase(),
        currentStep: session.currentStep,
        maxSteps: session.maxSteps,
        toolCalls: session.toolCalls,
        todos: session.todos,
        currentSql: session.currentSql,
        previousSql: session.previousSql,
        lastStreamingText: session.lastStreamingText,
        lastError: session.lastError,
        resumptionContext: session.resumptionContext,
        chatHistory: session.chatHistory,
        queryName: session.queryName,
        createdAt: session.createdAt.getTime(),
        updatedAt: session.updatedAt.getTime(),
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create agent session error:', error);
    return NextResponse.json({ error: 'Failed to create agent session' }, { status: 500 });
  }
}
