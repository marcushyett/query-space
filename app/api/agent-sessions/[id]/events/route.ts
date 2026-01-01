import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db/prisma';
import { requireUser } from '@/lib/auth/session';
import { isAgentRunning } from '@/lib/agent/backgroundRunner';

// Status constants matching Prisma enum
const AgentStatus = {
  PENDING: 'PENDING',
  RUNNING: 'RUNNING',
  PAUSED: 'PAUSED',
  COMPLETED: 'COMPLETED',
  FAILED: 'FAILED',
} as const;

// Type for AgentEvent from database
interface AgentEventRecord {
  id: string;
  sessionId: string;
  sequenceNumber: number;
  eventType: string;
  eventData: unknown;
  createdAt: Date;
}

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * Stream events for an agent session.
 * Supports two modes:
 * 1. Polling: GET ?lastSequence=N returns all events after sequence N as JSON
 * 2. Streaming: GET with Accept: text/event-stream returns SSE stream
 *
 * The client can reconnect at any time and catch up on missed events.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    await requireUser();

    const { id: sessionId } = await params;
    const { searchParams } = new URL(request.url);
    const lastSequenceParam = searchParams.get('lastSequence');
    const lastSequence = lastSequenceParam ? parseInt(lastSequenceParam, 10) : -1;
    const stream = request.headers.get('Accept')?.includes('text/event-stream');

    // Verify session exists
    const session = await prisma.agentSession.findUnique({
      where: { id: sessionId },
      select: { id: true, status: true, organizationId: true },
    });

    if (!session) {
      return new Response(JSON.stringify({ error: 'Session not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (stream) {
      // SSE streaming mode
      return streamEvents(sessionId, lastSequence, session.status);
    } else {
      // Polling mode - return events as JSON
      return pollEvents(sessionId, lastSequence, session.status);
    }
  } catch (error) {
    console.error('Events API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to get events';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Poll for events - returns all events after lastSequence as JSON.
 */
async function pollEvents(
  sessionId: string,
  lastSequence: number,
  currentStatus: string
) {
  const events = await prisma.agentEvent.findMany({
    where: {
      sessionId,
      sequenceNumber: { gt: lastSequence },
    },
    orderBy: { sequenceNumber: 'asc' },
    take: 100, // Limit to prevent huge responses
  });

  // Check if agent is still running
  const isRunning = isAgentRunning(sessionId) || currentStatus === AgentStatus.RUNNING;

  // Get the latest session state
  const session = await prisma.agentSession.findUnique({
    where: { id: sessionId },
    select: {
      status: true,
      currentStep: true,
      currentSql: true,
      queryName: true,
      lastError: true,
      todos: true,
    },
  });

  return new Response(
    JSON.stringify({
      events: events.map((e: AgentEventRecord) => ({
        sequence: e.sequenceNumber,
        type: e.eventType,
        data: e.eventData,
        timestamp: e.createdAt.toISOString(),
      })),
      isRunning,
      session: session
        ? {
            status: session.status,
            currentStep: session.currentStep,
            currentSql: session.currentSql,
            queryName: session.queryName,
            lastError: session.lastError,
            todos: session.todos,
          }
        : null,
      nextSequence: events.length > 0 ? events[events.length - 1].sequenceNumber : lastSequence,
    }),
    {
      headers: { 'Content-Type': 'application/json' },
    }
  );
}

/**
 * Stream events using Server-Sent Events.
 * Sends existing events immediately, then streams new events as they arrive.
 */
function streamEvents(
  sessionId: string,
  lastSequence: number,
  initialStatus: string
) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let currentSequence = lastSequence;
      let isComplete = false;

      // Helper to send an SSE event
      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        // First, send all existing events after lastSequence
        const existingEvents = await prisma.agentEvent.findMany({
          where: {
            sessionId,
            sequenceNumber: { gt: lastSequence },
          },
          orderBy: { sequenceNumber: 'asc' },
        });

        for (const event of existingEvents) {
          sendEvent({
            sequence: event.sequenceNumber,
            type: event.eventType,
            data: event.eventData,
          });
          currentSequence = event.sequenceNumber;

          // Check if this is a complete event
          if (event.eventType === 'complete') {
            isComplete = true;
          }
        }

        // If already complete or not running, send done and close
        if (isComplete || (initialStatus !== AgentStatus.RUNNING && initialStatus !== AgentStatus.PENDING)) {
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }

        // Poll for new events every 500ms while agent is running
        const pollInterval = setInterval(async () => {
          try {
            // Check if agent is still running
            const running = isAgentRunning(sessionId);

            // Get new events
            const newEvents = await prisma.agentEvent.findMany({
              where: {
                sessionId,
                sequenceNumber: { gt: currentSequence },
              },
              orderBy: { sequenceNumber: 'asc' },
            });

            for (const event of newEvents) {
              sendEvent({
                sequence: event.sequenceNumber,
                type: event.eventType,
                data: event.eventData,
              });
              currentSequence = event.sequenceNumber;

              if (event.eventType === 'complete') {
                isComplete = true;
              }
            }

            // If complete or no longer running, end the stream
            if (isComplete || !running) {
              // Check session status one more time to get any final events
              const session = await prisma.agentSession.findUnique({
                where: { id: sessionId },
                select: { status: true },
              });

              const isFinalStatus =
                session?.status === AgentStatus.COMPLETED ||
                session?.status === AgentStatus.FAILED ||
                session?.status === AgentStatus.PAUSED;

              if (isComplete || isFinalStatus) {
                clearInterval(pollInterval);
                controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                controller.close();
              }
            }
          } catch (error) {
            console.error('Polling error:', error);
            clearInterval(pollInterval);
            controller.error(error);
          }
        }, 500);

        // Handle client disconnect
        // Note: The cleanup happens when the stream is cancelled
      } catch (error) {
        console.error('Stream error:', error);
        controller.error(error);
      }
    },

    cancel() {
      // Client disconnected - this is fine, agent keeps running
      console.log(`Client disconnected from session ${sessionId}, agent continues running`);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
