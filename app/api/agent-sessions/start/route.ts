import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getClaudeApiKey, requireDatabaseConnection } from '@/lib/auth/organization-settings';
import { requireUser } from '@/lib/auth/session';
import { startBackgroundAgent } from '@/lib/agent/backgroundRunner';
import { AgentSessionStatus } from '@prisma/client';
import type { SchemaInfo } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface StartAgentRequest {
  prompt: string;
  organizationId: string;
  projectId?: string;
  schema: SchemaInfo[];
  previousSql?: string;
  previousContext?: string;
}

/**
 * Start a new background agent session.
 * The agent will continue running even if the client disconnects.
 * Returns the session ID immediately so the client can start polling for events.
 */
export async function POST(request: NextRequest) {
  try {
    // Require authentication
    const user = await requireUser();

    const body: StartAgentRequest = await request.json();
    const {
      prompt,
      organizationId,
      projectId,
      schema,
      previousSql,
      previousContext,
    } = body;

    if (!prompt || !prompt.trim()) {
      return NextResponse.json(
        { error: 'Missing required field: prompt' },
        { status: 400 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required field: organizationId' },
        { status: 400 }
      );
    }

    // Get API key from organization settings
    const effectiveApiKey = await getClaudeApiKey(organizationId);
    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'Claude API key is not configured. Go to Settings to add your Claude API key.' },
        { status: 400 }
      );
    }

    // Get connection string from organization settings
    let connectionString: string;
    try {
      connectionString = await requireDatabaseConnection(organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get database connection';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Create a new agent session in PENDING status
    const session = await prisma.agentSession.create({
      data: {
        organizationId,
        projectId,
        goal: prompt,
        status: AgentSessionStatus.PENDING,
        currentStep: 0,
        maxSteps: 25,
        previousSql,
        createdById: user.id,
      },
    });

    // Set the API key in environment for the Claude Agent SDK
    process.env.ANTHROPIC_API_KEY = effectiveApiKey;

    // Start the agent in the background (non-blocking)
    // We don't await this - it runs independently
    startBackgroundAgent({
      sessionId: session.id,
      organizationId,
      prompt: prompt.trim(),
      connectionString,
      schema,
      previousSql,
      previousContext,
    }).catch((error) => {
      // Log error but don't throw - the session status will be updated by the runner
      console.error('Background agent error:', error);
    });

    // Return the session ID immediately
    return NextResponse.json({
      sessionId: session.id,
      status: 'started',
    });
  } catch (error) {
    console.error('Start agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to start agent';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
