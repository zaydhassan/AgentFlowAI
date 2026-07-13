// =============================================================================
// MemoryEmbeddingWorker — example worker
// =============================================================================
// Consumes the `memory-embedding` queue. Each job carries { memoryId, content };
// the worker generates the embedding via the Memory Engine's embedding provider
// and attaches it to the memory row. This is the "enqueue embedding generation
// instead of blocking requests" path: lib/memory/repository.insertMemory()
// enqueues here (non-blocking) when the queue is up, and falls back to a
// synchronous embed when it is down — see lib/queue/index.ts enqueueEmbedding().
//
// Idempotent: repository.attachEmbedding() is ON CONFLICT DO NOTHING on the
// unique `memoryId`, so retries / duplicate jobs never double-insert.
//
// The Memory Engine itself is NOT modified beyond swapping the synchronous
// embedding call for this enqueue. recall/manage are untouched; a memory whose
// embedding is still pending simply isn't returned by vector search until this
// worker attaches its vector (hybrid/FTS still find it).
//
// Server-only.

import "server-only";
import { getEmbeddingProvider, repository } from "@/lib/memory";
import { getQueue, MEMORY_EMBEDDING_QUEUE, type JobHandler } from "@/lib/queue";
import type { MemoryEmbeddingJobData } from "@/lib/queue";

const EMBEDDING_CONCURRENCY = Number(process.env.MEMORY_EMBEDDING_CONCURRENCY ?? 4);

/** The job handler. Exported so it can be unit-tested without a live worker. */
export const handleMemoryEmbedding: JobHandler<MemoryEmbeddingJobData> = async (job) => {
  const { memoryId, content } = job.data;
  if (!memoryId || !content) return; // malformed job — drop, don't retry forever

  const provider = getEmbeddingProvider();
  if (!provider.configured) {
    // Embeddings aren't configured (no API key). Nothing to generate — leave the
    // memory without a vector (recall's vector path skips it). Don't fail/retry.
    return;
  }

  // Generate the embedding (the blocking OpenAI call — now off the request path).
  const { vector, dims, model } = await provider.embedOne(content);
  // Attach it. Idempotent on memoryId; safe across retries.
  await repository.attachEmbedding(memoryId, vector, dims, model);
};

let _started = false;

/**
 * Start the memory-embedding worker (idempotent — calling twice is a no-op).
 * Wired from instrumentation.ts on Node server boot (QUEUE_WORKER_AUTOSTART,
 * default true). In serverless prod, set QUEUE_WORKER_AUTOSTART=false and run
 * this in a dedicated worker process instead.
 */
export function startMemoryEmbeddingWorker(): void {
  if (_started) return;
  _started = true;
  getQueue(MEMORY_EMBEDDING_QUEUE).process(handleMemoryEmbedding, EMBEDDING_CONCURRENCY);
}