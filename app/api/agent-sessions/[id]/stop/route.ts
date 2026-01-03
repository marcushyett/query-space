import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Stop a running agent session.
 * With durable workflows, we signal stopping by setting the status to PAUSED.
 * The workflow will check this status and stop gracefully.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireUser();

    const { id: sessionId } = await params;

    // Verify session exists and get current status
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const wasRunning = session.status === 'RUNNING';

    // Update session status to PAUSED
    // The durable workflow will check this status and stop gracefully
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: 'PAUSED' },
    });

    return NextResponse.json({
      success: true,
      wasRunning,
      status: 'paused',
    });
  } catch (error) {
    console.error('Stop agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to stop agent';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
