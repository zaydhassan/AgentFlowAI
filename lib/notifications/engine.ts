import "server-only";
import { prisma } from "@/lib/db";
import { repository, buildDedupKey } from "@/lib/notifications/repository";
import {
  getPreferences,
  emailEnabledForEvent,
  isDigestFrequency,
} from "@/lib/notifications/preferences";
import { enqueueDelivery } from "@/lib/notifications/queue";
import { getProvider, providerConfigured } from "@/lib/notifications/providers";
import { renderEvent, renderDigestEmail } from "@/lib/notifications/templates";
import { buildDigestData, computePeriod } from "@/lib/notifications/scheduler";
import { requireEnv } from "@/lib/env";
import { logger } from "@/lib/logger";
import {
  NOTIFICATION_EVENTS,
  DEFAULT_PREFERENCES,
  type DigestData,
  type EmitResult,
  type NotificationChannel,
  type NotificationEventKey,
  type NotificationPayload,
  type OutboundMessage,
  type TemplateContext,
} from "@/lib/notifications/types";

/**
 * Generate a notification for an event. The producer-facing entry point — call
 * this from any seam (workflow run, billing webhook, integration lifecycle, …).
 * Never throws; returns an EmitResult describing what happened.
 */
export async function notify(
  event: NotificationEventKey,
  payload: NotificationPayload,
  ctx: { userId: string },
): Promise<EmitResult> {
  const meta = NOTIFICATION_EVENTS[event];
  if (!meta) {
    // Unknown event — refuse rather than emit garbage. Logged, not thrown.
    logger.warn("notifications: unknown event", { event });
    return { notificationId: null, enqueued: false, deduplicated: false, reason: "unknown-event" };
  }

  try {
    const userId = ctx.userId;
    const prefs = await getPreferences(userId);
    const emailWanted = emailEnabledForEvent(prefs, meta.preferenceFlag);

    const title = payload.title ?? meta.title;
    const body = payload.body ?? meta.description;

    const dedupKey = buildDedupKey(userId, event, payload);
    const existing = await repository.findNotificationByDedup(userId, dedupKey);
    if (existing) {
      return { notificationId: existing.id, enqueued: false, deduplicated: true, reason: "deduplicated" };
    }

    const useDigest = isDigestFrequency(prefs.frequency) && emailWanted;
    const digestEligible = useDigest;

    const created = await repository.createNotification({
      userId,
      event,
      category: meta.category,
      severity: payload.severity ?? meta.severity,
      title,
      body,
      entityType: payload.entityType,
      entityId: payload.entityId,
      link: payload.link,
      metadata: payload.data,
      dedupKey,
      digestEligible,
    });
    if (!created) {
      // Lost a race with a concurrent emit of the same dedup key.
      return { notificationId: null, enqueued: false, deduplicated: true, reason: "deduplicated" };
    }

    if (!emailWanted) {
      return { notificationId: created.id, enqueued: false, deduplicated: false, reason: "preference-disabled" };
    }
    if (useDigest) {
      return { notificationId: created.id, enqueued: false, deduplicated: false, reason: `digest:${prefs.frequency}` };
    }

    const delayMs = computeQuietHoursDelay(prefs.quietHoursStart, prefs.quietHoursEnd, prefs.timezone);
    const deliveryId = await repository.createDelivery({
      notificationId: created.id,
      userId,
      channel: "email",
      provider: "email",
    });
    const res = await enqueueDelivery(deliveryId, created.id, delayMs);
    if (res.queued) {
      return {
        notificationId: created.id,
        enqueued: true,
        deduplicated: false,
        reason: delayMs > 0 ? "queued-quiet-hours" : "queued",
      };
    }
    // Graceful fallback: the queue is unavailable (no REDIS_URL / runtime Redis
    // failure). Run the worker path synchronously so the email is still sent.
    // Best-effort — a failure is audited on the delivery row and never breaks the
    // calling seam. (Quiet-hours delay is a queue-time feature; without a queue
    // the send happens now, since a request-scoped setTimeout can't be relied on.)
    try {
      await deliverDelivery(deliveryId, created.id);
    } catch (err) {
      logger.error("notifications: sync delivery fallback failed", {
        deliveryId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    return {
      notificationId: created.id,
      enqueued: false,
      deduplicated: false,
      reason: "queue-unavailable-sync",
    };
  } catch (err) {
    // Never break the calling seam. Log and swallow.
    logger.error("notifications: emit failed", { event, error: err instanceof Error ? err.message : String(err) });
    return { notificationId: null, enqueued: false, deduplicated: false, reason: "emit-error" };
  }
}

/** Terminal statuses — a delivery in any of these is skipped (idempotency). */
const TERMINAL = new Set(["sent", "delivered", "suppressed", "bounced"]);

/**
 * Process one delivery. Called by the queue worker. Renders the template, sends
 * via the provider, audits the result. Idempotent + retry-aware: transient
 * failures throw (so the queue retries with backoff); permanent failures are
 * recorded without throwing.
 */
export async function deliverDelivery(deliveryId: string, notificationId: string): Promise<void> {
  const delivery = await prisma.notificationDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, userId: true, channel: true, status: true },
  });
  if (!delivery) return; // gone — nothing to do
  if (TERMINAL.has(delivery.status)) return; // already done — idempotent skip

  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
    select: { id: true, userId: true, event: true, title: true, body: true, severity: true, link: true, metadata: true },
  });
  if (!notification) return;
  const user = await prisma.user.findUnique({
    where: { id: delivery.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user || !user.email) {
    await repository.updateDelivery(deliveryId, { status: "suppressed", error: "no email address on file" });
    return;
  }

  const channel = delivery.channel as NotificationChannel;
  const provider = getProvider(channel);
  if (!provider || !providerConfigured(channel)) {
    await repository.updateDelivery(deliveryId, { status: "failed", error: `no provider for channel '${channel}'` });
    return;
  }

  const appUrl = requireEnv("APP_URL", "http://localhost:3000");
  const unsubscribeToken = await repository.ensureUnsubscribeToken(user.id);
  const ctx: TemplateContext = {
    user: { id: user.id, name: user.name, email: user.email },
    event: notification.event as NotificationEventKey,
    payload: {
      title: notification.title,
      body: notification.body,
      severity: notification.severity as TemplateContext["payload"]["severity"],
      link: notification.link ?? undefined,
      data: (notification.metadata as Record<string, unknown> | null) ?? undefined,
    },
    appUrl,
    unsubscribeToken,
  };
  const rendered = await renderEvent(ctx);

  const message: OutboundMessage = {
    to: user.email,
    toName: user.name,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    notificationId: notification.id,
    deliveryId,
  };

  await repository.updateDelivery(deliveryId, { status: "queued", incrementAttempts: true });
  let result;
  try {
    result = await provider.send(message);
  } catch (err) {
    const error = err instanceof Error ? err.message : "send threw";
    await repository.updateDelivery(deliveryId, { status: "failed", error, sentAt: new Date() });
    // Transient — throw so the queue retries with backoff.
    throw err;
  }

  if (result.ok) {
    await repository.updateDelivery(deliveryId, {
      status: result.status,
      providerMessageId: result.messageId ?? null,
      error: null,
      sentAt: new Date(),
    });
    return;
  }

  await repository.updateDelivery(deliveryId, {
    status: result.status,
    error: result.error ?? null,
    sentAt: result.status === "failed" ? new Date() : null,
  });

  // Permanent failures (bounce/suppress) are NOT retried. Transient failures
  // throw so the queue's exponential backoff re-attempts the job.
  if (result.status === "failed") {
    throw new Error(result.error ?? "delivery failed");
  }
  // bounced / suppressed → leave as terminal; do not throw.
}

/**
 * Build + send one user's digest for a frequency/period. Called by the queue
 * worker's "digest" job (enqueued by the scheduler). Audited on a
 * NotificationDigest row. Retries on transient failure (throws).
 */
export async function buildAndSendDigest(
  userId: string,
  frequency: "hourly" | "daily" | "weekly",
  periodStart: Date,
  periodEnd: Date,
): Promise<void> {
  const period = { start: periodStart, end: periodEnd, label: frequency };
  const prefs = await getPreferences(userId);

  const data: DigestData = await buildDigestData(userId, frequency, period);

  const digestId = await repository.createDigest({
    userId,
    frequency,
    periodStart,
    periodEnd,
    notificationCount: data.notificationCount,
    summary: {
      stats: data.stats,
      highlights: data.highlights,
      chart: data.chart,
      topWorkflows: data.topWorkflows,
    },
  });

  const optedIn = prefs.frequency === frequency &&
    (frequency === "hourly" || (frequency === "daily" && prefs.dailySummary) || (frequency === "weekly" && prefs.weeklySummary));
  if (!optedIn) {
    await repository.updateDigest(digestId, { status: "skipped", error: "not opted in" });
    return;
  }
  if (data.notificationCount === 0 && frequency !== "weekly") {
    await repository.updateDigest(digestId, { status: "skipped", error: "no activity in period" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, name: true, email: true } });
  if (!user || !user.email) {
    await repository.updateDigest(digestId, { status: "failed", error: "no email address on file" });
    return;
  }

  const appUrl = requireEnv("APP_URL", "http://localhost:3000");
  const unsubscribeToken = await repository.ensureUnsubscribeToken(user.id);
  const rendered = await renderDigestEmail({
    user: { id: user.id, name: user.name, email: user.email },
    event: "system.new_feature_announcement" as NotificationEventKey, // placeholder event for the ctx shape
    payload: {},
    appUrl,
    unsubscribeToken,
    digest: data,
  });

  const provider = getProvider("email");
  if (!provider || !provider.configured) {
    await repository.updateDigest(digestId, { status: "failed", error: "email provider not configured" });
    return;
  }

  try {
    const result = await provider.send({
      to: user.email,
      toName: user.name,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      notificationId: digestId,
      deliveryId: digestId,
    });
    if (result.ok) {
      await repository.updateDigest(digestId, { status: "sent" });
    } else {
      await repository.updateDigest(digestId, { status: "failed", error: result.error ?? "send failed" });
      if (result.status === "failed") throw new Error(result.error ?? "digest send failed");
    }
  } catch (err) {
    const error = err instanceof Error ? err.message : "digest send threw";
    await repository.updateDigest(digestId, { status: "failed", error });
    throw err; // transient → queue retries
  }
}

/**
 * If "now" (in the user's timezone) falls inside the quiet-hours window, return
 * the milliseconds until the window ends; otherwise 0. Handles overnight windows
 * (e.g. 22:00 → 07:00). Returns 0 when quiet hours aren't configured.
 */
export function computeQuietHoursDelay(
  startHHmm: string | null,
  endHHmm: string | null,
  timezone: string | null,
): number {
  if (!startHHmm || !endHHmm) return 0;
  const now = tzNow(timezone);
  const start = parseHHmm(startHHmm, now);
  let end = parseHHmm(endHHmm, now);
  // Overnight window: end is tomorrow.
  if (end.getTime() <= start.getTime()) end = new Date(end.getTime() + 86_400_000);

  const inWindow = now.getTime() >= start.getTime() && now.getTime() < end.getTime();
  if (!inWindow) return 0;
  return end.getTime() - now.getTime();
}

function tzNow(timezone: string | null): Date {
  if (!timezone) return new Date();
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "0";
    return new Date(`${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}`);
  } catch {
    return new Date();
  }
}

function parseHHmm(hhmm: string, ref: Date): Date {
  const [h, m] = hhmm.split(":").map((n) => Number(n));
  const d = new Date(ref);
  d.setHours(h ?? 0, m ?? 0, 0, 0);
  return d;
}

/** Trigger a digest for the current user on demand (dev/admin from the API). */
export async function triggerDigestForUser(
  userId: string,
  frequency: "hourly" | "daily" | "weekly",
): Promise<{ periodStart: string; periodEnd: string }> {
  const period = computePeriod(frequency);
  // Run synchronously (the API route is admin/dev-only and wants the result).
  await buildAndSendDigest(userId, frequency, period.start, period.end);
  return { periodStart: period.start.toISOString(), periodEnd: period.end.toISOString() };
}

/** Resolve a user's preferences for the API (cache-through). */
export async function getPreferencesForUser(userId: string) {
  return getPreferences(userId);
}

/** Update a user's preferences (writes through + invalidates the cache). */
export async function updatePreferencesForUser(
  userId: string,
  prefs: Partial<typeof DEFAULT_PREFERENCES>,
) {
  const { invalidatePreferences } = await import("@/lib/notifications/preferences");
  const next = await repository.upsertPreferences(userId, prefs);
  invalidatePreferences(userId);
  return next;
}

export { computePeriod };