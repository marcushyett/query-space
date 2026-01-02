-- Add PENDING to AgentSessionStatus enum (if not exists)
ALTER TYPE "AgentSessionStatus" ADD VALUE IF NOT EXISTS 'PENDING';

-- Add queryId column to agent_sessions
ALTER TABLE "agent_sessions" ADD COLUMN "queryId" TEXT;

-- CreateIndex
CREATE INDEX "agent_sessions_queryId_idx" ON "agent_sessions"("queryId");

-- AddForeignKey
ALTER TABLE "agent_sessions" ADD CONSTRAINT "agent_sessions_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
