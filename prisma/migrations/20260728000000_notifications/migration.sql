-- Notifications — provider-agnostic Notification Engine (lib/notifications).
-- All models are ADDITIVE: no existing table is altered. One Notification row
-- per generated event (user-scoped); NotificationDelivery audits every channel
-- send; NotificationPreference holds per-user opt-ins/frequency/quiet hours;
-- NotificationTemplate is the built-in template registry; NotificationDigest
-- records each digest run + its charts-ready summary payload.

-- CreateTable
CREATE TABLE "Notification" (
    "id"              TEXT NOT NULL,
    "userId"          TEXT NOT NULL,
    "category"        TEXT NOT NULL,
    "event"           TEXT NOT NULL,
    "severity"        TEXT NOT NULL DEFAULT 'info',
    "title"           TEXT NOT NULL,
    "body"            TEXT NOT NULL,
    "entityType"      TEXT,
    "entityId"        TEXT,
    "link"            TEXT,
    "metadata"        JSONB,
    "dedupKey"        TEXT,
    "read"            BOOLEAN NOT NULL DEFAULT false,
    "readAt"          TIMESTAMP(3),
    "digestEligible"  BOOLEAN NOT NULL DEFAULT false,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "workflowEmails"    BOOLEAN NOT NULL DEFAULT true,
    "aiEmails"          BOOLEAN NOT NULL DEFAULT true,
    "billingEmails"     BOOLEAN NOT NULL DEFAULT true,
    "securityEmails"    BOOLEAN NOT NULL DEFAULT true,
    "integrationEmails" BOOLEAN NOT NULL DEFAULT true,
    "dailySummary"      BOOLEAN NOT NULL DEFAULT true,
    "weeklySummary"     BOOLEAN NOT NULL DEFAULT true,
    "productUpdates"    BOOLEAN NOT NULL DEFAULT true,
    "frequency"         TEXT NOT NULL DEFAULT 'instant',
    "quietHoursStart"   TEXT,
    "quietHoursEnd"     TEXT,
    "timezone"          TEXT,
    "unsubscribeToken"  TEXT,
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"         TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDelivery" (
    "id"                 TEXT NOT NULL,
    "notificationId"     TEXT NOT NULL,
    "userId"             TEXT NOT NULL,
    "channel"            TEXT NOT NULL,
    "provider"           TEXT NOT NULL,
    "status"             TEXT NOT NULL DEFAULT 'pending',
    "providerMessageId"  TEXT,
    "attempts"           INTEGER NOT NULL DEFAULT 0,
    "error"              TEXT,
    "sentAt"             TIMESTAMP(3),
    "deliveredAt"        TIMESTAMP(3),
    "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"          TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationTemplate" (
    "id"          TEXT NOT NULL,
    "key"         TEXT NOT NULL,
    "category"    TEXT NOT NULL,
    "name"        TEXT NOT NULL,
    "description" TEXT,
    "channels"    TEXT[] DEFAULT ARRAY['email','in_app']::TEXT[],
    "builtIn"     BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NotificationTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationDigest" (
    "id"                TEXT NOT NULL,
    "userId"            TEXT NOT NULL,
    "frequency"         TEXT NOT NULL,
    "periodStart"       TIMESTAMP(3) NOT NULL,
    "periodEnd"         TIMESTAMP(3) NOT NULL,
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "summary"           JSONB,
    "status"            TEXT NOT NULL DEFAULT 'pending',
    "error"             TEXT,
    "sentAt"            TIMESTAMP(3),
    "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationDigest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_category_createdAt_idx" ON "Notification"("userId", "category", "createdAt");
CREATE INDEX "Notification_userId_read_createdAt_idx" ON "Notification"("userId", "read", "createdAt");
CREATE INDEX "Notification_userId_severity_createdAt_idx" ON "Notification"("userId", "severity", "createdAt");
CREATE INDEX "Notification_userId_digestEligible_createdAt_idx" ON "Notification"("userId", "digestEligible", "createdAt");
CREATE UNIQUE INDEX "Notification_userId_dedupKey_key" ON "Notification"("userId", "dedupKey");

CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
CREATE UNIQUE INDEX "NotificationPreference_unsubscribeToken_key" ON "NotificationPreference"("unsubscribeToken");

CREATE INDEX "NotificationDelivery_notificationId_idx" ON "NotificationDelivery"("notificationId");
CREATE INDEX "NotificationDelivery_userId_status_createdAt_idx" ON "NotificationDelivery"("userId", "status", "createdAt");
CREATE INDEX "NotificationDelivery_channel_status_createdAt_idx" ON "NotificationDelivery"("channel", "status", "createdAt");

CREATE UNIQUE INDEX "NotificationTemplate_key_key" ON "NotificationTemplate"("key");
CREATE INDEX "NotificationTemplate_category_idx" ON "NotificationTemplate"("category");

CREATE INDEX "NotificationDigest_userId_frequency_periodStart_idx" ON "NotificationDigest"("userId", "frequency", "periodStart");
CREATE INDEX "NotificationDigest_status_periodEnd_idx" ON "NotificationDigest"("status", "periodEnd");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery" ADD CONSTRAINT "NotificationDelivery_notificationId_fkey"
  FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDigest" ADD CONSTRAINT "NotificationDigest_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;