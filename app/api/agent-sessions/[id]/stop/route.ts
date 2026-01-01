import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUser } from '@/lib/auth/session';
import { stopBackgroundAgent, isAgentRunning } from '@/lib/agent/backgroundRunner';
import { AgentSessionStatus } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Stop a running agent session.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireUser();

    const { id: sessionId } = await params;

    // Verify session exists
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if agent is running
    const wasRunning = isAgentRunning(sessionId);

    // Stop the agent
    stopBackgroundAgent(sessionId);

    // Update session status to PAUSED
    await prisma.agentSession.update({
      where: { id: sessionId },
      data: { status: AgentSessionStatus.PAUSED },
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
