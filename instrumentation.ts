// Next.js instrumentation hook — runs once per Node.js server process at boot.
// Used here to start the background job workers (BullMQ) and to initialize
// centralized error monitoring (lib/monitoring). The memory-embedding worker
// consumes the `memory-embedding` queue so embedding generation runs off the
// request path. Monitoring installs process-level uncaughtException /
// unhandledRejection handlers so every unhandled backend error is captured.
//
// `register()` runs in the Node.js runtime only (skipped for the edge runtime).
// Monitoring initializes unconditionally (independent of the queue) so global
// error capture is active even when the queue is disabled. The queue block
// below is gated by QUEUE_WORKER_AUTOSTART / QUEUE_ENABLED / REDIS_URL — set
// QUEUE_WORKER_AUTOSTART=false to disable (e.g. serverless prod, where a
// long-lived BullMQ worker doesn't fit the function model — run the worker in
// a dedicated process / container instead and let only enqueue happen here).
//
// See lib/monitoring/ + lib/queue/ + lib/queue/workers/memory-embedding.ts.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  // --- Monitoring (additive, independent of the queue) ---------------------
  // Initialize before the queue block: global error capture must be active
  // even when the queue is disabled or Redis is absent. Best-effort — a
  // failure here never blocks boot (monitoring is optional infrastructure).
  try {
    const { initMonitoring } = await import("./lib/monitoring");
    initMonitoring();
  } catch {
    // Monitoring unavailable (e.g. disabled or SDK missing) — carry on.
  }

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
}