-- AlterTable: Add missing queryId column to query_executions
ALTER TABLE "query_executions" ADD COLUMN "queryId" TEXT;

-- CreateIndex: Add index on queryId for faster lookups
CREATE INDEX "query_executions_queryId_idx" ON "query_executions"("queryId");

-- AddForeignKey: Link query_executions.queryId to queries.id
ALTER TABLE "query_executions" ADD CONSTRAINT "query_executions_queryId_fkey" FOREIGN KEY ("queryId") REFERENCES "queries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
