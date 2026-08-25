export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // Initialize before the queue block: global error capture must be active
  // even when the queue is disabled or Redis is absent. Best-effort — a
  // failure here never blocks boot (monitoring is optional infrastructure).
  try {
    const { initMonitoring } = await import("./lib/monitoring");
    initMonitoring();
  } catch {
    // Monitoring unavailable (e.g. disabled or SDK missing) — carry on.
  }

  // Idempotent upsert; needs only the DB, not Redis, so it runs unconditionally
  // (before the queue gate below). Best-effort — a failure never blocks boot.
  try {
    const { seedTemplates } = await import("./lib/notifications/repository");
    void seedTemplates().catch(() => { /* best-effort */ });
  } catch { /* notifications module unavailable — carry on */ }

  if ((process.env.QUEUE_WORKER_AUTOSTART ?? "true").toLowerCase() === "false") return;
  if ((process.env.QUEUE_ENABLED ?? "true").toLowerCase() === "false") return;
  if (!process.env.REDIS_URL?.trim()) return;

  try {
    const { startMemoryEmbeddingWorker } = await import("./lib/queue/workers/memory-embedding");
    startMemoryEmbeddingWorker();
  } catch {
    // BullMQ/Redis unavailable — enqueue falls back to synchronous; workers
    // simply don't run. The app stays fully functional.
  }

  // Start the notification worker (consumes the `notifications` queue: per-event
  // email deliveries with retry/backoff/DLQ, digest builds, and the self-
  // perpetuating scheduler heartbeat). Requires Redis; when absent, deliveries
  // fall back to synchronous sends (engine.notify) and digests can be driven by
  // the /api/notifications/digest/run cron route.
  try {
    const { startNotificationWorker } = await import("./lib/notifications/queue");
    startNotificationWorker();
  } catch {
    // Worker unavailable — enqueue falls back to synchronous; the cron route
    // can drive digests. The app stays fully functional.
  }
}