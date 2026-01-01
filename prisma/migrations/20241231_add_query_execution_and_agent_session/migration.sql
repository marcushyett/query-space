-- CreateEnum
CREATE TYPE "QuerySource" AS ENUM ('MANUAL', 'AI');

-- CreateEnum
CREATE TYPE "AgentSessionStatus" AS ENUM ('RUNNING', 'PAUSED', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "query_executions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "sql" TEXT NOT NULL,
    "queryName" TEXT,
    "source" "QuerySource" NOT NULL DEFAULT 'MANUAL',
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error" TEXT,
    "rowCount" INTEGER,
    "executionTime" INTEGER,
    "agentSessionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "query_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_sessions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "projectId" TEXT,
    "goal" TEXT NOT NULL,
    "status" "AgentSessionStatus" NOT NULL DEFAULT 'RUNNING',
    "currentStep" INTEGER NOT NULL DEFAULT 0,
    "maxSteps" INTEGER NOT NULL DEFAULT 25,
    "toolCalls" JSONB,
    "todos" JSONB,
    "currentSql" TEXT,
    "previousSql" TEXT,
    "lastStreamingText" TEXT,
    "lastError" TEXT,
    "resumptionContext" TEXT,
    "chatHistory" JSONB,
    "queryName" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "agent_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "query_executions_organizationId_idx" ON "query_executions"("organizationId");

-- CreateIndex
CREATE INDEX "query_executions_projectId_idx" ON "query_executions"("projectId");

-- CreateIndex
CREATE INDEX "query_executions_agentSessionId_idx" ON "query_executions"("agentSessionId");

-- CreateIndex
CREATE INDEX "query_executions_createdAt_idx" ON "query_executions"("createdAt");

-- CreateIndex
CREATE INDEX "agent_sessions_organizationId_idx" ON "agent_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "agent_sessions_projectId_idx" ON "agent_sessions"("projectId");

-- CreateIndex
CREATE INDEX "agent_sessions_status_idx" ON "agent_sessions"("status");

-- CreateIndex
CREATE INDEX "agent_sessions_createdAt_idx" ON "agent_sessions"("createdAt");

-- AddForeignKey
ALTER TABLE "query_executions" ADD CONSTRAINT "query_executions_agentSessionId_fkey" FOREIGN KEY ("agentSessionId") REFERENCES "agent_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
