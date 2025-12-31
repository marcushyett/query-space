import { NextRequest } from 'next/server';
import { streamQueryAgent, MAX_AGENT_STEPS, type AgentStreamEvent, type SchemaInfo } from '@/lib/agent';
import { getClaudeApiKey, requireDatabaseConnection } from '@/lib/auth/organization-settings';
import { requireUser } from '@/lib/auth/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 780; // 13 minutes - Vercel's maximum for serverless functions

// Warn before timeout - give 30 seconds buffer for graceful shutdown
const TIMEOUT_WARNING_MS = 750 * 1000; // 12.5 minutes (750 seconds)

interface AgentRequest {
  prompt: string;
  organizationId: string;
  schema: SchemaInfo[];
  previousSql?: string;
  previousContext?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    // Require authentication
    await requireUser();

    const body: AgentRequest = await request.json();
    const {
      prompt,
      organizationId,
      schema,
      previousSql,
      previousContext,
    } = body;

    if (!prompt || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: prompt' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!organizationId) {
      return new Response(
        JSON.stringify({ error: 'Missing required field: organizationId' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get API key from organization settings or environment variable
    const effectiveApiKey = await getClaudeApiKey(organizationId);

    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({ error: 'Claude API key is not configured. Go to Settings to add your Claude API key.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get connection string from organization settings
    let connectionString: string;
    try {
      connectionString = await requireDatabaseConnection(organizationId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to get database connection';
      return new Response(
        JSON.stringify({ error: message }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Set the API key in environment for the Claude Agent SDK
    process.env.ANTHROPIC_API_KEY = effectiveApiKey;

    // Create abort controller for client disconnect
    const abortController = new AbortController();

    // Stream the response
    const stream = new ReadableStream({
      async start(controller) {
        const startTime = Date.now();
        let timeoutWarningSent = false;

        try {
          const agentStream = streamQueryAgent(
            prompt,
            {
              connectionString,
              schema,
              previousSql,
              previousContext,
            },
            abortController.signal
          );

          for await (const event of agentStream) {
            if (abortController.signal.aborted) {
              break;
            }

            // Check if we're approaching the timeout limit
            const elapsed = Date.now() - startTime;
            if (!timeoutWarningSent && elapsed >= TIMEOUT_WARNING_MS) {
              timeoutWarningSent = true;
              const timeoutEvent: AgentStreamEvent = {
                type: 'error',
                error: 'Approaching execution time limit. The session will be paused automatically. You can resume it to continue.',
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(timeoutEvent)}\n\n`));

              // Send a complete event with timeout reason so the client knows to pause
              const completeEvent: AgentStreamEvent = {
                type: 'complete',
                state: {
                  goal: '',
                  currentStep: 0,
                  maxSteps: MAX_AGENT_STEPS,
                  hasCompletedGoal: false,
                  currentSql: null,
                  previousSql: null,
                  lastError: null,
                  toolCalls: [],
                  reachedStepLimit: false,
                  assumptions: [],
                  dataQualityNotes: null,
                  alternativeApproaches: [],
                  todos: [],
                  hasIncompleteTodos: true,
                  stopReason: 'timeout',
                },
              };
              controller.enqueue(encoder.encode(`data: ${JSON.stringify(completeEvent)}\n\n`));
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              abortController.abort();
              return;
            }

            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          }

          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';

          // Handle specific error types
          let statusMessage = errorMessage;
          if (errorMessage.includes('invalid_api_key') || errorMessage.includes('authentication')) {
            statusMessage = 'Invalid API key. Please check your Claude API key.';
          } else if (errorMessage.includes('rate_limit')) {
            statusMessage = 'Rate limit exceeded. Please try again later.';
          } else if (errorMessage.includes('overloaded')) {
            statusMessage = 'Claude is currently overloaded. Please try again in a moment.';
          }

          const errorEvent: AgentStreamEvent = {
            type: 'error',
            error: statusMessage,
          };

          controller.enqueue(encoder.encode(`data: ${JSON.stringify(errorEvent)}\n\n`));
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
        }
      },

      cancel() {
        abortController.abort();
      },
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error) {
    console.error('AI agent error:', error);

    const errorMessage = error instanceof Error ? error.message : 'Failed to start agent';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// Also expose the max steps for clients
export async function GET() {
  return new Response(
    JSON.stringify({ maxSteps: MAX_AGENT_STEPS }),
    { headers: { 'Content-Type': 'application/json' } }
  );
}
