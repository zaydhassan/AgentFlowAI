-- Integrations: provider-agnostic OAuth credential store. One row per
-- connected third-party account (Gmail first; Slack/Notion/GitHub/Drive later
-- reuse the same table). Token columns hold AES-256-GCM ciphertext, never
-- plaintext. Additive only — no existing table is touched.

CREATE TABLE "IntegrationAccount" (
    "id"                 TEXT NOT NULL,
    "ownerId"            TEXT NOT NULL,
    "orgId"              TEXT,
    "provider"           TEXT NOT NULL,
    "providerAccountId"  TEXT NOT NULL,
    "email"              TEXT,
    "label"              TEXT NOT NULL,
    "scopes"             TEXT[] DEFAULT ARRAY[]::TEXT[],
    "accessToken"        TEXT NOT NULL,
    "refreshToken"       TEXT NOT NULL,
    "expiresAt"          TIMESTAMP(3),
    "status"             TEXT NOT NULL DEFAULT 'active',
    "metadata"           JSONB,
    "lastPollHistoryId"  TEXT,
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationAccount_pkey" PRIMARY KEY ("id")
);

-- A user can't connect the same provider account twice.
CREATE UNIQUE INDEX "IntegrationAccount_ownerId_provider_providerAccountId_key"
    ON "IntegrationAccount"("ownerId", "provider", "providerAccountId");

-- Workspace + owner listings.
CREATE INDEX "IntegrationAccount_orgId_provider_idx"
    ON "IntegrationAccount"("orgId", "provider");
CREATE INDEX "IntegrationAccount_ownerId_provider_idx"
    ON "IntegrationAccount"("ownerId", "provider");

-- Back-reference to the connecting user. Matches the Prisma relation
-- (onDelete: Cascade). The User table already exists.
ALTER TABLE "IntegrationAccount"
    ADD CONSTRAINT "IntegrationAccount_ownerId_fkey"
    FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;