import { NextRequest } from 'next/server';
import { streamQueryAgent, MAX_AGENT_STEPS, type AgentStreamEvent, type SchemaInfo } from '@/lib/agent';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minute max for agent execution

interface AgentRequest {
  prompt: string;
  apiKey: string;
  connectionString: string;
  schema: SchemaInfo[];
  previousSql?: string;
  previousContext?: string;
}

export async function POST(request: NextRequest) {
  const encoder = new TextEncoder();

  try {
    const body: AgentRequest = await request.json();
    const {
      prompt,
      apiKey,
      connectionString,
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

    const effectiveApiKey = apiKey || process.env.CLAUDE_API_KEY;
    if (!effectiveApiKey) {
      return new Response(
        JSON.stringify({ error: 'API key is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!connectionString) {
      return new Response(
        JSON.stringify({ error: 'Database connection is required' }),
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
