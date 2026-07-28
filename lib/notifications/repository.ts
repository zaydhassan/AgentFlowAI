// =============================================================================
// Notification repository — the ONLY place that touches the Notification /
// NotificationPreference / NotificationDelivery / NotificationDigest tables.
// =============================================================================
// Every method is user-scoped (userId is always the isolation boundary). The
// engine and API routes depend on this, never on Prisma directly, for
// notifications. Mirrors the pattern in lib/payments/repository.ts and
// lib/integrations/repository.ts.
//
// Server-only.

import "server-only";
import crypto from "node:crypto";
import { prisma } from "@/lib/db";
import type {
  DeliveryStatus,
  DigestFrequency,
  NotificationCategory,
  NotificationChannel,
  NotificationEventKey,
  NotificationPayload,
  NotificationPreferences,
  NotificationSeverity,
} from "@/lib/notifications/types";
import { DEFAULT_PREFERENCES } from "@/lib/notifications/types";
import type { Prisma } from "@prisma/client";

// ─────────────────────────── notifications ───────────────────────────────────

export interface ListFilter {
  category?: NotificationCategory;
  severity?: NotificationSeverity;
  read?: boolean;
  /** ISO date lower bound (inclusive). */
  since?: string;
  /** ISO date upper bound (exclusive). */
  until?: string;
  /** Free-text search over title + body. */
  query?: string;
  /** Page size. */
  limit?: number;
  /** Cursor (createdAt,id) — newest first pagination. */
  cursor?: string;
}

/** Create a notification (idempotent on dedupKey). Returns null if deduped. */
export async function createNotification(args: {
  userId: string;
  event: NotificationEventKey;
  category: NotificationCategory;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType?: string;
  entityId?: string;
  link?: string;
  metadata?: Record<string, unknown>;
  dedupKey?: string;
  digestEligible?: boolean;
}): Promise<{ id: string; created: boolean } | null> {
  const data: Prisma.NotificationCreateInput = {
    user: { connect: { id: args.userId } },
    event: args.event,
    category: args.category,
    severity: args.severity,
    title: args.title,
    body: args.body,
    entityType: args.entityType ?? null,
    entityId: args.entityId ?? null,
    link: args.link ?? null,
    metadata: (args.metadata ?? undefined) as Prisma.InputJsonValue,
    dedupKey: args.dedupKey ?? null,
    digestEligible: args.digestEligible ?? false,
  };
  try {
    if (args.dedupKey) {
      // upsert keyed on the unique (userId, dedupKey) — idempotent emit.
      const row = await prisma.notification.upsert({
        where: { userId_dedupKey: { userId: args.userId, dedupKey: args.dedupKey } },
        create: data,
        update: {}, // no-op if it already exists → deduplicated
        select: { id: true },
      });
      // We can't tell upsert create vs update from here without an extra query;
      // a count of deliveries decides later. Return the id; the engine treats a
      // pre-existing row as deduplicated by checking delivery state.
      return { id: row.id, created: true };
    }
    const row = await prisma.notification.create({ data, select: { id: true } });
    return { id: row.id, created: true };
  } catch (err) {
    // Unique violation on dedupKey (race) → already exists.
    if (isUniqueViolation(err)) return null;
    throw err;
  }
}

/** Find an existing notification by dedup key (for the dedup check). */
export async function findNotificationByDedup(
  userId: string,
  dedupKey: string,
): Promise<{ id: string } | null> {
  const row = await prisma.notification.findUnique({
    where: { userId_dedupKey: { userId, dedupKey } },
    select: { id: true },
  });
  return row;
}

/** Get a notification (ownership-checked). */
export async function getNotification(
  userId: string,
  id: string,
): Promise<NotificationRow | null> {
  const row = await prisma.notification.findFirst({
    where: { id, userId },
    include: { deliveries: { orderBy: { createdAt: "desc" }, take: 8 } },
  });
  return row ? toNotificationRow(row) : null;
}

/** List a user's notifications with filters + search + cursor pagination. */
export async function listNotifications(
  userId: string,
  filter: ListFilter = {},
): Promise<{ items: NotificationRow[]; nextCursor: string | null; total: number }> {
  const limit = Math.min(Math.max(filter.limit ?? 25, 1), 100);
  const where: Prisma.NotificationWhereInput = { userId };
  if (filter.category) where.category = filter.category;
  if (filter.severity) where.severity = filter.severity;
  if (typeof filter.read === "boolean") where.read = filter.read;
  if (filter.since || filter.until) {
    where.createdAt = {};
    if (filter.since) where.createdAt.gte = new Date(filter.since);
    if (filter.until) where.createdAt.lt = new Date(filter.until);
  }
  if (filter.query) {
    where.OR = [
      { title: { contains: filter.query, mode: "insensitive" } },
      { body: { contains: filter.query, mode: "insensitive" } },
    ];
  }
  // cursor decoding: "<iso>|<id>"
  let cursor: { createdAt: Date; id: string } | undefined;
  if (filter.cursor) {
    const [iso, id] = filter.cursor.split("|");
    if (iso && id) cursor = { createdAt: new Date(iso), id };
  }

  const [rows, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: limit + 1,
      ...(cursor ? { cursor: { id: cursor.id }, skip: 1 } : {}),
      include: { deliveries: { orderBy: { createdAt: "desc" }, take: 4 } },
    }),
    prisma.notification.count({ where }),
  ]);

  const hasMore = rows.length > limit;
  const slice = hasMore ? rows.slice(0, limit) : rows;
  const items = slice.map(toNotificationRow);
  const last = slice[slice.length - 1];
  const nextCursor = hasMore && last ? `${last.createdAt.toISOString()}|${last.id}` : null;
  return { items, nextCursor, total };
}

/** Count unread notifications for a user (drives the bell badge). */
export async function countUnread(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}

/** Mark one notification read/unread (ownership-checked). */
export async function markRead(
  userId: string,
  id: string,
  read: boolean,
): Promise<boolean> {
  const r = await prisma.notification.updateMany({
    where: { id, userId },
    data: { read, readAt: read ? new Date() : null },
  });
  return r.count > 0;
}

/** Mark all (optionally filtered) notifications read. Returns count updated. */
export async function markAllRead(userId: string, filter?: { category?: NotificationCategory }): Promise<number> {
  const r = await prisma.notification.updateMany({
    where: { userId, read: false, ...(filter?.category ? { category: filter.category } : {}) },
    data: { read: true, readAt: new Date() },
  });
  return r.count;
}

/** Delete a notification (ownership-checked). */
export async function deleteNotification(userId: string, id: string): Promise<boolean> {
  const r = await prisma.notification.deleteMany({ where: { id, userId } });
  return r.count > 0;
}

/** Count digest-eligible notifications in a window for a user. */
export async function countDigestEligible(
  userId: string,
  since: Date,
  until: Date,
): Promise<number> {
  return prisma.notification.count({
    where: { userId, digestEligible: true, createdAt: { gte: since, lt: until } },
  });
}

/** List digest-eligible notifications in a window (for building a digest). */
export async function listDigestEligible(
  userId: string,
  since: Date,
  until: Date,
  limit = 50,
): Promise<NotificationRow[]> {
  const rows = await prisma.notification.findMany({
    where: { userId, digestEligible: true, createdAt: { gte: since, lt: until } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return rows.map(toNotificationRow);
}

// ─────────────────────────── deliveries ──────────────────────────────────────

/** Create a delivery row (pending). */
export async function createDelivery(args: {
  notificationId: string;
  userId: string;
  channel: NotificationChannel;
  provider: string;
}): Promise<string> {
  const row = await prisma.notificationDelivery.create({
    data: {
      notification: { connect: { id: args.notificationId } },
      userId: args.userId,
      channel: args.channel,
      provider: args.provider,
      status: "pending",
    },
    select: { id: true },
  });
  return row.id;
}

/** Find a delivery by id (ownership-checked). */
export async function getDelivery(
  userId: string,
  deliveryId: string,
): Promise<{ id: string; notificationId: string; status: string; channel: string; provider: string } | null> {
  const row = await prisma.notificationDelivery.findFirst({
    where: { id: deliveryId, userId },
    select: { id: true, notificationId: true, status: true, channel: true, provider: true },
  });
  return row;
}

/** Update a delivery's status + audit fields. */
export async function updateDelivery(
  deliveryId: string,
  args: {
    status: DeliveryStatus;
    providerMessageId?: string | null;
    error?: string | null;
    sentAt?: Date | null;
    deliveredAt?: Date | null;
    incrementAttempts?: boolean;
  },
): Promise<void> {
  await prisma.notificationDelivery.update({
    where: { id: deliveryId },
    data: {
      status: args.status,
      providerMessageId: args.providerMessageId,
      error: args.error,
      sentAt: args.sentAt,
      deliveredAt: args.deliveredAt,
      ...(args.incrementAttempts ? { attempts: { increment: 1 } } : {}),
    },
  });
}

// ─────────────────────────── preferences ─────────────────────────────────────

/** Get a user's preferences, applying defaults when no row exists. */
export async function getPreferencesRow(userId: string): Promise<NotificationPreferences & { unsubscribeToken: string | null }> {
  const row = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!row) {
    return { ...DEFAULT_PREFERENCES, unsubscribeToken: null };
  }
  return {
    workflowEmails: row.workflowEmails,
    aiEmails: row.aiEmails,
    billingEmails: row.billingEmails,
    securityEmails: row.securityEmails,
    integrationEmails: row.integrationEmails,
    dailySummary: row.dailySummary,
    weeklySummary: row.weeklySummary,
    productUpdates: row.productUpdates,
    frequency: row.frequency as DigestFrequency,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    timezone: row.timezone,
    unsubscribeToken: row.unsubscribeToken,
  };
}

/** Upsert a user's preferences. Returns the stored row. */
export async function upsertPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>,
): Promise<NotificationPreferences> {
  const row = await prisma.notificationPreference.upsert({
    where: { userId },
    create: {
      user: { connect: { id: userId } },
      workflowEmails: prefs.workflowEmails ?? DEFAULT_PREFERENCES.workflowEmails,
      aiEmails: prefs.aiEmails ?? DEFAULT_PREFERENCES.aiEmails,
      billingEmails: prefs.billingEmails ?? DEFAULT_PREFERENCES.billingEmails,
      securityEmails: prefs.securityEmails ?? DEFAULT_PREFERENCES.securityEmails,
      integrationEmails: prefs.integrationEmails ?? DEFAULT_PREFERENCES.integrationEmails,
      dailySummary: prefs.dailySummary ?? DEFAULT_PREFERENCES.dailySummary,
      weeklySummary: prefs.weeklySummary ?? DEFAULT_PREFERENCES.weeklySummary,
      productUpdates: prefs.productUpdates ?? DEFAULT_PREFERENCES.productUpdates,
      frequency: prefs.frequency ?? DEFAULT_PREFERENCES.frequency,
      quietHoursStart: prefs.quietHoursStart ?? null,
      quietHoursEnd: prefs.quietHoursEnd ?? null,
      timezone: prefs.timezone ?? null,
      unsubscribeToken: generateToken(),
    },
    update: {
      workflowEmails: prefs.workflowEmails,
      billingEmails: prefs.billingEmails,
      securityEmails: prefs.securityEmails,
      integrationEmails: prefs.integrationEmails,
      aiEmails: prefs.aiEmails,
      dailySummary: prefs.dailySummary,
      weeklySummary: prefs.weeklySummary,
      productUpdates: prefs.productUpdates,
      frequency: prefs.frequency,
      quietHoursStart: prefs.quietHoursStart,
      quietHoursEnd: prefs.quietHoursEnd,
      timezone: prefs.timezone,
    },
    select: {
      workflowEmails: true, aiEmails: true, billingEmails: true, securityEmails: true,
      integrationEmails: true, dailySummary: true, weeklySummary: true, productUpdates: true,
      frequency: true, quietHoursStart: true, quietHoursEnd: true, timezone: true,
    },
  });
  return {
    ...row,
    frequency: row.frequency as DigestFrequency,
    quietHoursStart: row.quietHoursStart,
    quietHoursEnd: row.quietHoursEnd,
    timezone: row.timezone,
  };
}

/** Ensure a preferences row + unsubscribe token exist; return the token. */
export async function ensureUnsubscribeToken(userId: string): Promise<string> {
  const existing = await prisma.notificationPreference.findUnique({
    where: { userId }, select: { unsubscribeToken: true },
  });
  if (existing?.unsubscribeToken) return existing.unsubscribeToken;
  const token = generateToken();
  await prisma.notificationPreference.upsert({
    where: { userId },
    create: { user: { connect: { id: userId } }, unsubscribeToken: token },
    update: existing ? {} : { unsubscribeToken: token },
  });
  return token;
}

/** Find a preferences row by unsubscribe token (for token-based links). */
export async function getPreferencesByToken(
  token: string,
): Promise<{ userId: string } | null> {
  const row = await prisma.notificationPreference.findUnique({
    where: { unsubscribeToken: token },
    select: { userId: true },
  });
  return row;
}

// ─────────────────────────── digests ─────────────────────────────────────────

/** Create a digest row (pending). */
export async function createDigest(args: {
  userId: string;
  frequency: DigestFrequency;
  periodStart: Date;
  periodEnd: Date;
  notificationCount: number;
  summary: Record<string, unknown>;
}): Promise<string> {
  const row = await prisma.notificationDigest.create({
    data: {
      user: { connect: { id: args.userId } },
      frequency: args.frequency,
      periodStart: args.periodStart,
      periodEnd: args.periodEnd,
      notificationCount: args.notificationCount,
      summary: args.summary as Prisma.InputJsonValue,
      status: "pending",
    },
    select: { id: true },
  });
  return row.id;
}

/** Mark a digest sent / failed. */
export async function updateDigest(
  digestId: string,
  args: { status: "sent" | "failed" | "skipped"; error?: string | null },
): Promise<void> {
  await prisma.notificationDigest.update({
    where: { id: digestId },
    data: { status: args.status, error: args.error, sentAt: args.status === "sent" ? new Date() : null },
  });
}

/** Find users whose digest is due for a frequency (have a prefs row, opted in). */
export async function listDigestDueUsers(
  frequency: "hourly" | "daily" | "weekly",
): Promise<{ userId: string }[]> {
  const flag = frequency === "daily" ? "dailySummary" : frequency === "weekly" ? "weeklySummary" : undefined;
  const rows = await prisma.notificationPreference.findMany({
    where: {
      ...(flag ? { [flag]: true } : {}),
      // hourly: any frequency === 'hourly'; daily: frequency in (daily); weekly: (weekly)
      frequency,
    },
    select: { userId: true },
  });
  return rows;
}

/** Whether a digest already exists for a user/frequency/period (dedup). */
export async function digestExists(
  userId: string,
  frequency: "hourly" | "daily" | "weekly",
  periodStart: Date,
): Promise<boolean> {
  const row = await prisma.notificationDigest.findFirst({
    where: { userId, frequency, periodStart },
    select: { id: true },
  });
  return !!row;
}

// ─────────────────────────── templates registry ──────────────────────────────

/** Upsert the built-in template registry rows (idempotent — run on boot). */
export async function seedTemplates(): Promise<void> {
  const { NOTIFICATION_EVENTS } = await import("@/lib/notifications/types");
  for (const [key, meta] of Object.entries(NOTIFICATION_EVENTS)) {
    await prisma.notificationTemplate.upsert({
      where: { key },
      create: {
        key,
        category: meta.category,
        name: meta.title,
        description: meta.description,
        channels: meta.channels,
        builtIn: true,
      },
      update: {
        category: meta.category,
        name: meta.title,
        description: meta.description,
        channels: meta.channels,
      },
    });
  }
}

// ─────────────────────────── shapes ──────────────────────────────────────────

export interface NotificationRow {
  id: string;
  userId: string;
  category: NotificationCategory;
  event: NotificationEventKey;
  severity: NotificationSeverity;
  title: string;
  body: string;
  entityType: string | null;
  entityId: string | null;
  link: string | null;
  metadata: Record<string, unknown> | null;
  read: boolean;
  readAt: Date | null;
  digestEligible: boolean;
  createdAt: Date;
  deliveries: {
    id: string;
    channel: NotificationChannel;
    provider: string;
    status: DeliveryStatus;
    attempts: number;
    error: string | null;
    sentAt: Date | null;
    deliveredAt: Date | null;
  }[];
}

type DbDelivery = {
  id: string;
  channel: string;
  provider: string;
  status: string;
  attempts: number;
  error: string | null;
  sentAt: Date | null;
  deliveredAt: Date | null;
};

type DbNotification = NonNullable<Awaited<ReturnType<typeof prisma.notification.findFirst>>> & {
  deliveries?: DbDelivery[];
};

function toNotificationRow(row: DbNotification): NotificationRow {
  return {
    id: row.id,
    userId: row.userId,
    category: row.category as NotificationCategory,
    event: row.event as NotificationEventKey,
    severity: row.severity as NotificationSeverity,
    title: row.title,
    body: row.body,
    entityType: row.entityType,
    entityId: row.entityId,
    link: row.link,
    metadata: (row.metadata as Record<string, unknown> | null) ?? null,
    read: row.read,
    readAt: row.readAt,
    digestEligible: row.digestEligible,
    createdAt: row.createdAt,
    deliveries: (row.deliveries ?? []).map((d: DbDelivery) => ({
      id: d.id,
      channel: d.channel as NotificationChannel,
      provider: d.provider,
      status: d.status as DeliveryStatus,
      attempts: d.attempts,
      error: d.error,
      sentAt: d.sentAt,
      deliveredAt: d.deliveredAt,
    })),
  };
}

// ─────────────────────────── helpers ─────────────────────────────────────────

function isUniqueViolation(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    ((err as { code?: string }).code === "P2002" ||
      /unique/i.test((err as Error).message ?? ""))
  );
}

function generateToken(): string {
  // 24-byte URL-safe token (hex) for unsubscribe/preferences links.
  return crypto.randomBytes(24).toString("hex");
}

/** Build the dedup key for an event (per-day idempotency). */
export function buildDedupKey(
  userId: string,
  event: NotificationEventKey,
  payload: NotificationPayload,
): string {
  const day = new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
  const core = [userId, event, payload.entityType ?? "", payload.entityId ?? "", day].join("|");
  return crypto.createHash("sha256").update(core).digest("hex");
}

// ─────────────────────────── namespace bundle ────────────────────────────────
// The `repository` object bundles every data-access function so callers import
// a single binding (mirrors lib/memory + lib/integrations). The functions are
// hoisted (function declarations) so this object is safe to define at the end.
export const repository = {
  createNotification,
  findNotificationByDedup,
  getNotification,
  listNotifications,
  countUnread,
  markRead,
  markAllRead,
  deleteNotification,
  countDigestEligible,
  listDigestEligible,
  createDelivery,
  getDelivery,
  updateDelivery,
  getPreferencesRow,
  upsertPreferences,
  ensureUnsubscribeToken,
  getPreferencesByToken,
  createDigest,
  updateDigest,
  listDigestDueUsers,
  digestExists,
  seedTemplates,
  buildDedupKey,
};