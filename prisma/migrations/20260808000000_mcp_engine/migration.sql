-- MCP engine: server registry, capability/tool cache, and invocation audit.
--
-- These four models were present in schema.prisma but had no migration, so the
-- tables were missing from the DB and every /api/mcp/* route (and MCP tool
-- invocation during execution) threw "The table public.McpServer does not
-- exist". This migration creates only the MCP tables; it intentionally does NOT
-- touch the Memory/Embedding raw-SQL artifacts (the `search` tsvector column +
-- GIN/HNSW indexes) created by 20260714000000_memory_engine, which Prisma cannot
-- model and which `prisma db push` would otherwise drop.

-- CreateTable
CREATE TABLE "McpServer" (
    "id" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orgId" TEXT,
    "name" TEXT NOT NULL,
    "transport" TEXT NOT NULL,
    "endpoint" TEXT,
    "command" TEXT,
    "args" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "envEncrypted" TEXT,
    "authScheme" TEXT,
    "credentials" TEXT,
    "status" TEXT NOT NULL DEFAULT 'disconnected',
    "health" JSONB,
    "allowList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "denyList" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "lastSessionId" TEXT,
    "lastDiscoveredAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpServer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpCapability" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "supported" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpCapability_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpToolCache" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "description" TEXT,
    "inputSchema" JSONB,
    "annotations" JSONB,
    "uri" TEXT,
    "mimeType" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "McpToolCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "McpInvocation" (
    "id" TEXT NOT NULL,
    "serverId" TEXT NOT NULL,
    "ownerId" TEXT NOT NULL,
    "orgId" TEXT,
    "toolName" TEXT NOT NULL,
    "arguments" JSONB,
    "status" TEXT NOT NULL,
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "tokensEstimate" INTEGER NOT NULL DEFAULT 0,
    "streamed" BOOLEAN NOT NULL DEFAULT false,
    "workflowId" TEXT,
    "nodeId" TEXT,
    "agentId" TEXT,
    "runId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "McpInvocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "McpServer_orgId_idx" ON "McpServer"("orgId");

-- CreateIndex
CREATE INDEX "McpServer_ownerId_idx" ON "McpServer"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "McpServer_ownerId_name_key" ON "McpServer"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "McpCapability_serverId_kind_key" ON "McpCapability"("serverId", "kind");

-- CreateIndex
CREATE INDEX "McpToolCache_serverId_kind_idx" ON "McpToolCache"("serverId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "McpToolCache_serverId_kind_name_key" ON "McpToolCache"("serverId", "kind", "name");

-- CreateIndex
CREATE INDEX "McpInvocation_serverId_createdAt_idx" ON "McpInvocation"("serverId", "createdAt");

-- CreateIndex
CREATE INDEX "McpInvocation_ownerId_createdAt_idx" ON "McpInvocation"("ownerId", "createdAt");

-- CreateIndex
CREATE INDEX "McpInvocation_workflowId_idx" ON "McpInvocation"("workflowId");

-- AddForeignKey
ALTER TABLE "McpServer" ADD CONSTRAINT "McpServer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpCapability" ADD CONSTRAINT "McpCapability_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpToolCache" ADD CONSTRAINT "McpToolCache_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "McpInvocation" ADD CONSTRAINT "McpInvocation_serverId_fkey" FOREIGN KEY ("serverId") REFERENCES "McpServer"("id") ON DELETE CASCADE ON UPDATE CASCADE;