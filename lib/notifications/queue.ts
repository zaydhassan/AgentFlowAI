// =============================================================================
// Notification queue — wraps the app's existing BullMQ layer (lib/queue) with
// notification-specific enqueue helpers + the worker that processes deliveries
// and digests. Reuses the provider-agnostic QueueProvider abstraction; this
// module NEVER touches BullMQ directly, so the same Redis/no-op fallback applies
// (when Redis is absent, deliveries run synchronously as a graceful fallback).
// =============================================================================
// Job kinds:
//   - "deliver"  : send one notification delivery via the resolved provider.
//                  Retry + exponential backoff + dead-letter on exhaustion.
//                  Idempotent: the engine checks delivery status before sending.
//   - "digest"   : build + send one user's digest for a frequency.
//   - "tick"     : scheduler heartbeat — find due digests and enqueue "digest"
//                  jobs, then re-schedule itself (self-perpetuating, so no
//                  external cron is required — though /api/notifications/digest/run
//                  can also drive it on a hosted cron).
//
// Server-only.

import "server-only";
import {
  getQueue,
  type EnqueueResult,
  type JobHandler,
} from "@/lib/queue";

export const NOTIFICATION_QUEUE = "notifications";

/** Job data for a "deliver" job. */
export interface DeliverJobData {
  deliveryId: string;
  notificationId: string;
}

/** Job data for a "digest" job. */
export interface DigestJobData {
  userId: string;
  frequency: "hourly" | "daily" | "weekly";
  /** ISO — the digest covers [periodStart, periodEnd). Computed by the scheduler. */
  periodStart: string;
  periodEnd: string;
}

/** Job data for a "tick" (scheduler heartbeat). */
export interface TickJobData {
  at: string; // ISO — when the tick fired
}

const ATTEMPTS = Number(process.env.NOTIFICATION_DELIVERY_ATTEMPTS ?? 5);
const BACKOFF_MS = Number(process.env.NOTIFICATION_DELIVERY_BACKOFF_MS ?? 3000);

/** Enqueue a delivery send (retry + exponential backoff + DLQ).
 *  `delayMs` holds the send until quiet hours end (instant frequency only). */
export async function enqueueDelivery(
  deliveryId: string,
  notificationId: string,
  delayMs?: number,
): Promise<EnqueueResult> {
  return getQueue(NOTIFICATION_QUEUE).enqueue(
    "deliver",
    { deliveryId, notificationId } satisfies DeliverJobData,
    {
      priority: 5,
      attempts: ATTEMPTS,
      backoff: { type: "exponential", delay: BACKOFF_MS },
      delay: delayMs && delayMs > 0 ? delayMs : undefined,
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
}

/** Enqueue a digest build+send. */
export async function enqueueDigest(
  userId: string,
  frequency: "hourly" | "daily" | "weekly",
  periodStart: Date,
  periodEnd: Date,
): Promise<EnqueueResult> {
  return getQueue(NOTIFICATION_QUEUE).enqueue(
    "digest",
    {
      userId,
      frequency,
      periodStart: periodStart.toISOString(),
      periodEnd: periodEnd.toISOString(),
    } satisfies DigestJobData,
    {
      priority: 10,
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
      removeOnComplete: 500,
      removeOnFail: 2000,
    },
  );
}

/** Self-perpetuating scheduler heartbeat. Delays itself by TICK_INTERVAL_MS. */
const TICK_INTERVAL_MS = Number(process.env.NOTIFICATION_TICK_INTERVAL_MS ?? 15 * 60 * 1000); // 15 min
export async function enqueueTick(): Promise<EnqueueResult> {
  return getQueue(NOTIFICATION_QUEUE).enqueue(
    "tick",
    { at: new Date().toISOString() } satisfies TickJobData,
    {
      attempts: 1,
      delay: TICK_INTERVAL_MS,
      removeOnComplete: 100,
      removeOnFail: 500,
    },
  );
}

// ─────────────────────────── worker ──────────────────────────────────────────

import { deliverDelivery, buildAndSendDigest } from "@/lib/notifications/engine";
import { runDueDigests } from "@/lib/notifications/scheduler";

const CONCURRENCY = Number(process.env.NOTIFICATION_WORKER_CONCURRENCY ?? 4);

/** The unified handler for all notification queue jobs. */
export const handleNotificationJob: JobHandler<DeliverJobData | DigestJobData | TickJobData> = async (job) => {
  switch (job.name) {
    case "deliver":
      await deliverDelivery((job.data as DeliverJobData).deliveryId, (job.data as DeliverJobData).notificationId);
      return;
    case "digest": {
      const d = job.data as DigestJobData;
      await buildAndSendDigest(d.userId, d.frequency, new Date(d.periodStart), new Date(d.periodEnd));
      return;
    }
    case "tick":
      // Find due digests across users + enqueue them, then schedule the next tick.
      await runDueDigests();
      await enqueueTick();
      return;
    default:
      // Unknown job kind — drop (don't retry forever).
      return;
  }
};

let _started = false;

/**
 * Start the notification worker (idempotent). Wired from instrumentation.ts on
 * Node server boot (NOTIFICATION_WORKER_AUTOSTART, default true) and from the
 * backend worker container. Also kicks the scheduler heartbeat so digests run
 * without an external cron. In serverless prod, set QUEUE_WORKER_AUTOSTART=false
 * and run this in a dedicated worker process + drive ticks via the cron route.
 */
export function startNotificationWorker(): void {
  if (_started) return;
  _started = true;
  getQueue(NOTIFICATION_QUEUE).process(handleNotificationJob, CONCURRENCY);
  // Kick the scheduler heartbeat (no-op when the queue is disabled — enqueueTick
  // returns { queued: false } and the cron route can drive ticks instead).
  void enqueueTick().catch(() => { /* best-effort */ });
}

/** Reset the started flag — exposed for tests. */
export function __resetNotificationWorkerForTests(): void {
  _started = false;
}