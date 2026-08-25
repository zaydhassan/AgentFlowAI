import "server-only";
// Type-only (erased at runtime): give the BullMQ/ioredis surfaces real types
// without eager-loading the packages. Runtime imports happen in the methods.
import type { Job, JobsOptions, Queue, Worker } from "bullmq";
import type Redis from "ioredis";
import type {
  EnqueueResult,
  JobHandler,
  JobOptions,
  QueueMetrics,
  QueueProvider,
  QueueSnapshot,
  WorkerHandle,
} from "./types";
export type {
  EnqueueResult,
  JobHandler,
  JobOptions,
  QueueMetrics,
  QueueProvider,
  QueueJob,
  WorkerHandle,
  QueueSnapshot,
  QueueSnapshotEntry,
} from "./types";

// Producer connection (shared). Worker connections are created per-worker.
let _producerRedis: Redis | null = null;
let _producerPromise: Promise<Redis> | null = null;

function queueEnabled(): boolean {
  if ((process.env.QUEUE_ENABLED ?? "true").toLowerCase() === "false") return false;
  return !!process.env.REDIS_URL?.trim();
}

async function getProducerRedis(): Promise<Redis> {
  if (_producerRedis) return _producerRedis;
  if (_producerPromise) return _producerPromise;
  const connectTimeoutMs = Number(process.env.QUEUE_CONNECT_TIMEOUT_MS ?? 3000);
  _producerPromise = (async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("ioredis");
    const RedisCtor = mod.default ?? mod;
    const redis: Redis = new RedisCtor(process.env.REDIS_URL!.trim(), {
      maxRetriesPerRequest: null, // REQUIRED by BullMQ
      enableReadyCheck: true,
      connectTimeout: connectTimeoutMs,
      retryStrategy: (times: number) => Math.min(times * 200, 1000),
    });
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("queue redis connect timeout")), connectTimeoutMs);
      const onReady = () => { clearTimeout(timer); redis.off("error", onError); resolve(); };
      const onError = (err: Error) => { clearTimeout(timer); redis.disconnect(); reject(err); };
      redis.once("ready", onReady);
      redis.once("error", onError);
    });
    _producerRedis = redis;
    return redis;
  })().catch((err) => {
    _producerPromise = null; // allow a later retry
    throw err;
  });
  return _producerPromise;
}

async function createWorkerRedis(): Promise<Redis> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mod: any = await import("ioredis");
  const RedisCtor = mod.default ?? mod;
  return new RedisCtor(process.env.REDIS_URL!.trim(), {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectTimeout: Number(process.env.QUEUE_CONNECT_TIMEOUT_MS ?? 3000),
    retryStrategy: (times: number) => Math.min(times * 200, 1000),
  });
}

// BullMQ's `ConnectionOptions` union is narrower than ioredis's `Redis`
// instance type at the type layer (ioredis version drift between our dep and
// bullmq's); at RUNTIME a live ioredis instance is exactly what BullMQ accepts.
// Bridge the type with an explicit cast so we keep real types everywhere else.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function asConnection(redis: Redis): any {
  return redis;
}

// BullMQ's keep-jobs option (`KeepJobs` object form) has no equivalent in our
// generic JobOptions — coerce objects away so fromBullOpts stays assignable.
function coerceKeep(v: number | boolean | object | undefined): number | boolean | undefined {
  return typeof v === "object" ? undefined : v;
}

// Map generic JobOptions → BullMQ JobsOptions.
function toBullOpts(opts: JobOptions | undefined): JobsOptions {
  return {
    priority: opts?.priority,
    attempts: opts?.attempts ?? 1,
    backoff: opts?.backoff,
    delay: opts?.delay,
    removeOnComplete: opts?.removeOnComplete ?? 1000,
    removeOnFail: opts?.removeOnFail ?? 5000,
  };
}

function fromBullOpts(opts: JobsOptions): JobOptions {
  return {
    priority: opts?.priority,
    attempts: opts?.attempts,
    backoff: opts?.backoff as JobOptions["backoff"],
    delay: opts?.delay,
    removeOnComplete: coerceKeep(opts?.removeOnComplete),
    removeOnFail: coerceKeep(opts?.removeOnFail),
  };
}

// Active when the queue is disabled. `enqueue` returns { queued: false } so the
// caller (e.g. the memory engine) runs the work synchronously — identical to
// pre-queue behavior. Zero overhead.
class NoopQueueProvider implements QueueProvider {
  readonly id = "noop";
  readonly active = false;
  constructor(readonly queueName: string) {}
  async enqueue(): Promise<EnqueueResult> { return { id: "", queued: false }; }
  async retry(): Promise<boolean> { return false; }
  async delay(): Promise<boolean> { return false; }
  async remove(): Promise<boolean> { return false; }
  async getMetrics(): Promise<QueueMetrics> {
    return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
  }
  process(): WorkerHandle {
    return { queueName: this.queueName, close: async () => {} };
  }
  async close(): Promise<void> {}
}

class RedisQueueProvider implements QueueProvider {
  readonly id = "bullmq";
  readonly active = true;
  private queue: Queue | null = null;       // BullMQ Queue (producer)
  private dlq: Queue | null = null;          // dead-letter Queue
  private worker: Worker | null = null;      // BullMQ Worker (consumer), if started
  private workerRedis: Redis | null = null;  // the worker's own connection
  private workerHandle: WorkerHandle | null = null;

  constructor(readonly queueName: string) {}

  private async ensureQueue(): Promise<Queue> {
    if (this.queue) return this.queue;
    const { Queue: QueueCtor } = await import("bullmq");
    const connection = await getProducerRedis();
    this.queue = new QueueCtor(this.queueName, { connection: asConnection(connection) });
    return this.queue;
  }

  private async ensureDlq(): Promise<Queue> {
    if (this.dlq) return this.dlq;
    const { Queue: QueueCtor } = await import("bullmq");
    const connection = await getProducerRedis();
    // The DLQ is a normal BullMQ queue; exhausted jobs are copied here with
    // their failure reason, then removed from the main queue.
    this.dlq = new QueueCtor(`${this.queueName}:dlq`, { connection: asConnection(connection) });
    return this.dlq;
  }

  async enqueue(jobName: string, data: unknown, opts?: JobOptions): Promise<EnqueueResult> {
    try {
      const q = await this.ensureQueue();
      const job = await q.add(jobName, data, toBullOpts(opts));
      return { id: job.id ?? "", queued: true };
    } catch {
      // Runtime graceful fallback: Redis down / connection refused. The caller
      // checks `queued` and runs the work synchronously.
      return { id: "", queued: false };
    }
  }

  async retry(jobId: string): Promise<boolean> {
    try {
      const q = await this.ensureQueue();
      const job = await q.getJob(jobId);
      if (!job) return false;
      await job.retry();
      return true;
    } catch { return false; }
  }

  async delay(jobId: string, delayMs: number): Promise<boolean> {
    try {
      const q = await this.ensureQueue();
      const job = await q.getJob(jobId);
      if (!job) return false;
      await job.changeDelay(Math.max(0, Math.floor(delayMs)));
      return true;
    } catch { return false; }
  }

  async remove(jobId: string): Promise<boolean> {
    try {
      const q = await this.ensureQueue();
      const job = await q.getJob(jobId);
      if (!job) return false;
      await job.remove();
      return true;
    } catch { return false; }
  }

  async getMetrics(): Promise<QueueMetrics> {
    try {
      const q = await this.ensureQueue();
      const c = await q.getJobCounts("waiting", "active", "completed", "failed", "delayed", "paused");
      return {
        waiting: c.waiting ?? 0,
        active: c.active ?? 0,
        completed: c.completed ?? 0,
        failed: c.failed ?? 0,
        delayed: c.delayed ?? 0,
        paused: c.paused ?? 0,
      };
    } catch {
      return { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, paused: 0 };
    }
  }

  process<T = unknown>(handler: JobHandler<T>, concurrency = 1): WorkerHandle {
    if (this.workerHandle) return this.workerHandle;
    // Start the worker asynchronously; BullMQ connects + begins consuming once
    // the connection is ready. `close()` waits for it.
    void (async () => {
      const { Worker: WorkerCtor } = await import("bullmq");
      const connection = await createWorkerRedis();
      this.workerRedis = connection;
      this.worker = new WorkerCtor(
        this.queueName,
        async (job: Job) => {
          await handler({
            id: job.id ?? "",
            name: job.name,
            data: job.data as T,
            attemptsMade: job.attemptsMade,
            opts: fromBullOpts(job.opts),
          });
        },
        { connection: asConnection(connection), concurrency },
      );
      // Dead-letter: when a job has exhausted its attempts, copy it to the DLQ
      // (with the failure reason) and remove it from the main queue.
      this.worker.on("failed", async (job: Job | undefined, err: Error) => {
        if (!job) return;
        const attempts: number = job.opts?.attempts ?? 1;
        if (job.attemptsMade >= attempts) {
          try {
            const dlq = await this.ensureDlq();
            await dlq.add(job.name, {
              originalId: job.id,
              jobName: job.name,
              data: job.data,
              reason: err.message,
              failedAt: new Date().toISOString(),
            }, { removeOnComplete: 1000, removeOnFail: 5000 });
            await job.remove();
          } catch { /* best-effort */ }
        }
      });
    })().catch(() => { /* connection failure retried by ioredis */ });
    this.workerHandle = {
      queueName: this.queueName,
      close: async () => {
        try { await this.worker?.close(); } catch { /* best-effort */ }
        try { await this.workerRedis?.quit(); } catch { /* best-effort */ }
        this.worker = null;
        this.workerRedis = null;
        this.workerHandle = null;
      },
    };
    return this.workerHandle;
  }

  async close(): Promise<void> {
    try { await this.worker?.close(); } catch { /* best-effort */ }
    try { await this.workerRedis?.quit(); } catch { /* best-effort */ }
    try { await this.queue?.close(); } catch { /* best-effort */ }
    try { await this.dlq?.close(); } catch { /* best-effort */ }
  }
}

const _providers = new Map<string, QueueProvider>();

/** Return the provider for a logical queue (memoized per name). */
export function getQueue(name: string): QueueProvider {
  const existing = _providers.get(name);
  if (existing) return existing;
  const p = queueEnabled() ? new RedisQueueProvider(name) : new NoopQueueProvider(name);
  _providers.set(name, p);
  return p;
}

/** Snapshot every queue's provider + counters (for /api/queue metrics). */
export async function queueSnapshot(): Promise<QueueSnapshot> {
  const out: QueueSnapshot = {};
  for (const [name, p] of _providers) {
    out[name] = { provider: p.id, active: p.active, metrics: await p.getMetrics() };
  }
  return out;
}

/** Reset the singleton map — exposed for tests / env hot-reload, not runtime use. */
export async function __resetQueueForTests(): Promise<void> {
  await Promise.allSettled([..._providers.values()].map((p) => p.close()));
  _providers.clear();
  try { await _producerRedis?.quit(); } catch { /* best-effort */ }
  _producerRedis = null;
  _producerPromise = null;
}

/** Logical queue name for memory-embedding jobs. Shared with the worker. */
export const MEMORY_EMBEDDING_QUEUE = "memory-embedding";

/** Job data for an embedding job. */
export interface MemoryEmbeddingJobData {
  memoryId: string;
  content: string;
}

/**
 * Enqueue an embedding generation for a memory. Returns true when the job was
 * accepted by the backend; false when the queue is unavailable (the caller —
 * lib/memory/repository — then generates the embedding synchronously as a
 * graceful fallback). Retries with exponential backoff; exhausted jobs move to
 * the dead-letter queue. Configurable via env (MEMORY_EMBEDDING_ATTEMPTS,
 * MEMORY_EMBEDDING_BACKOFF_MS).
 */
export async function enqueueEmbedding(memoryId: string, content: string): Promise<boolean> {
  const result = await getQueue(MEMORY_EMBEDDING_QUEUE).enqueue(
    "embed",
    { memoryId, content } satisfies MemoryEmbeddingJobData,
    {
      priority: 0,
      attempts: Number(process.env.MEMORY_EMBEDDING_ATTEMPTS ?? 5),
      backoff: {
        type: "exponential",
        delay: Number(process.env.MEMORY_EMBEDDING_BACKOFF_MS ?? 2000),
      },
      removeOnComplete: 1000,
      removeOnFail: 5000,
    },
  );
  return result.queued;
}