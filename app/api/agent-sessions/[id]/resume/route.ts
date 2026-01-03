import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { getClaudeApiKey, requireDatabaseConnection } from '@/lib/auth/organization-settings';
import { requireUser } from '@/lib/auth/session';
import { runDurableAgent } from '@/lib/agent/durableAgentWorkflow';
import type { SchemaInfo } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface ResumeRequest {
  schema: SchemaInfo[];
  model?: string;
}

/**
 * Resume a paused agent session.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    await requireUser();
    const { id: sessionId } = await params;

    const body: ResumeRequest = await request.json();
    const { schema, model } = body;

    // Get the session
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Check if already running
    if (session.status === 'RUNNING') {
      return NextResponse.json({ error: 'Session is already running' }, { status: 400 });
    }

    // Only allow resuming paused sessions
    if (session.status !== 'PAUSED') {
      return NextResponse.json(
        { error: `Cannot resume session with status: ${session.status}` },
        { status: 400 }
      );
    }

    // Get API key
    const effectiveApiKey = await getClaudeApiKey(session.organizationId);
    if (!effectiveApiKey) {
      return NextResponse.json(
        { error: 'Claude API key is not configured.' },
        { status: 400 }
      );
    }

    // Get connection string
    let connectionString: string;
    try {
      connectionString = await requireDatabaseConnection(session.organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get database connection';
      return NextResponse.json({ error: message }, { status: 400 });
    }

    // Build resume prompt
    const todos = session.todos as { id: string; text: string; status: string }[] || [];
    const incompleteTodos = todos.filter((t) => t.status === 'pending' || t.status === 'in_progress');
    const completedTodos = todos.filter((t) => t.status === 'completed');

    const resumePrompt = `Resume working on the goal: ${session.goal}

${session.resumptionContext || ''}

## CRITICAL INSTRUCTIONS FOR RESUMPTION
You are resuming a previous session. The todo list already exists with ${completedTodos.length}/${todos.length} tasks completed.

${
  incompleteTodos.length > 0
    ? `INCOMPLETE TASKS (must be completed):
${incompleteTodos.map((t) => `- [${t.status === 'in_progress' ? 'IN PROGRESS' : 'PENDING'}] id="${t.id}" - ${t.text}`).join('\n')}

Steps to continue:
1. DO NOT recreate the todo list - it already exists!
2. Use manage_todo(action="set_current", item_id="<id from list above>") to mark the next pending task as in progress
3. Complete that task
4. Use manage_todo(action="complete", item_id="<id from list above>") to mark it done
5. Repeat for ALL remaining tasks
6. ONLY call update_query_ui and set_query_name after ALL todos are completed

IMPORTANT: Use the EXACT item_id values shown above. Do NOT fabricate or guess IDs.`
    : 'All tasks appear complete. Verify the work and finalize.'
}`;

    // Set the API key
    process.env.ANTHROPIC_API_KEY = effectiveApiKey;

    // Add "Continue" message to chatHistory
    const existingHistory = (session.chatHistory as Array<{
      role: string;
      content: string;
      timestamp: number;
    }>) || [];

    await prisma.agentSession.update({
      where: { id: sessionId },
      data: {
        chatHistory: [
          ...existingHistory,
          {
            role: 'user',
            content: 'Continue',
            timestamp: Date.now(),
          },
        ],
      },
    });

    // Start the durable agent workflow
    runDurableAgent({
      sessionId,
      organizationId: session.organizationId,
      prompt: resumePrompt,
      connectionString,
      schema,
      previousSql: session.currentSql || undefined,
      previousContext: session.resumptionContext || undefined,
      model,
    }).catch((error) => {
      console.error('Durable agent resume error:', error);
    });

    return NextResponse.json({
      sessionId,
      status: 'resumed',
    });
  } catch (error) {
    console.error('Resume agent error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to resume agent';
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
