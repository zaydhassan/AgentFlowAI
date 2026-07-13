// Next.js instrumentation hook — runs once per Node.js server process at boot.
// Used here to start the background job workers (BullMQ). The memory-embedding
// worker consumes the `memory-embedding` queue so embedding generation runs off
// the request path.
//
// `register()` runs in the Node.js runtime only (skipped for the edge runtime).
// Set QUEUE_WORKER_AUTOSTART=false to disable (e.g. in serverless prod, where a
// long-lived BullMQ worker doesn't fit the function model — run the worker in a
// dedicated process / container instead and let only enqueue happen here).
//
// See lib/queue/ + lib/queue/workers/memory-embedding.ts.

export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
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