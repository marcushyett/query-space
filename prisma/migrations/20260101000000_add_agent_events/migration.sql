-- Add PENDING status to AgentSessionStatus enum
ALTER TYPE "AgentSessionStatus" ADD VALUE 'PENDING' BEFORE 'RUNNING';

-- Create agent_events table
CREATE TABLE "agent_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "eventData" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_events_pkey" PRIMARY KEY ("id")
);

-- Add unique constraint for session + sequence number
CREATE UNIQUE INDEX "agent_events_sessionId_sequenceNumber_key" ON "agent_events"("sessionId", "sequenceNumber");

-- Add indexes for efficient querying
CREATE INDEX "agent_events_sessionId_sequenceNumber_idx" ON "agent_events"("sessionId", "sequenceNumber");
CREATE INDEX "agent_events_sessionId_createdAt_idx" ON "agent_events"("sessionId", "createdAt");

-- Add foreign key constraint
ALTER TABLE "agent_events" ADD CONSTRAINT "agent_events_sessionId_fkey"
    FOREIGN KEY ("sessionId") REFERENCES "agent_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
