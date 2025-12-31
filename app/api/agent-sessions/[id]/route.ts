import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db/prisma';
import { getCurrentUser, checkOrganizationAccess } from '@/lib/auth/session';

const updateSessionSchema = z.object({
  status: z.enum(['RUNNING', 'PAUSED', 'COMPLETED', 'FAILED']).optional(),
  currentStep: z.number().optional(),
  toolCalls: z.any().optional(),
  todos: z.any().optional(),
  currentSql: z.string().nullable().optional(),
  previousSql: z.string().nullable().optional(),
  lastStreamingText: z.string().optional(),
  lastError: z.string().nullable().optional(),
  resumptionContext: z.string().optional(),
  chatHistory: z.any().optional(),
  queryName: z.string().optional(),
});

// GET /api/agent-sessions/[id] - Get a single session
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    const session = await prisma.agentSession.findUnique({
      where: { id },
      include: {
        queryExecutions: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check organization access
    const access = await checkOrganizationAccess(session.organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

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
        queryExecutions: session.queryExecutions.map((e) => ({
          id: e.id,
          sql: e.sql,
          queryName: e.queryName,
          source: e.source.toLowerCase(),
          success: e.success,
          error: e.error,
          rowCount: e.rowCount,
          executionTime: e.executionTime,
          createdAt: e.createdAt.getTime(),
        })),
      },
    });
  } catch (error) {
    console.error('Get agent session error:', error);
    return NextResponse.json({ error: 'Failed to fetch session' }, { status: 500 });
  }
}

// PATCH /api/agent-sessions/[id] - Update a session
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check session exists and get org ID
    const existing = await prisma.agentSession.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check organization access
    const access = await checkOrganizationAccess(existing.organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const body = await request.json();
    const parsed = updateSessionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const session = await prisma.agentSession.update({
      where: { id },
      data: parsed.data,
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
    });
  } catch (error) {
    console.error('Update agent session error:', error);
    return NextResponse.json({ error: 'Failed to update session' }, { status: 500 });
  }
}

// DELETE /api/agent-sessions/[id] - Delete a session
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // Check session exists and get org ID
    const existing = await prisma.agentSession.findUnique({
      where: { id },
      select: { organizationId: true },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check organization access
    const access = await checkOrganizationAccess(existing.organizationId);
    if (!access) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    await prisma.agentSession.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete agent session error:', error);
    return NextResponse.json({ error: 'Failed to delete session' }, { status: 500 });
  }
}
