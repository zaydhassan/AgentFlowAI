// =============================================================================
// Queue — provider-agnostic background-job contract
// =============================================================================
// Any job backend (BullMQ/Redis, a no-op fallback, a future SQS/Beanstalk
// adapter) implements `QueueProvider` and plugs in via `getQueue()` in
// ./index. The rest of the app depends only on this interface + the helpers,
// never on BullMQ directly. Pure types (no server-only) so client-safe modules
// may reference the shapes.

/** Per-job options. BullMQ-backed, but named generically here. */
export interface JobOptions {
  /** BullMQ priority — LOWER number = HIGHER priority (1 runs before 10). Default 0. */
  priority?: number;
  /** Total attempts including the first run. Configurable retries. Default 1 (no retry). */
  attempts?: number;
  /** Backoff strategy between retries. `exponential` multiplies the delay each attempt. */
  backoff?: { type: "exponential" | "fixed"; delay: number };
  /** Delay the first run by this many milliseconds (scheduled/delayed jobs). */
  delay?: number;
  /** Keep N completed jobs (true = keep all, false = keep none). Default 1000. */
  removeOnComplete?: number | boolean;
  /** Keep N failed jobs before pruning (the rest move to the dead-letter queue). */
  removeOnFail?: number | boolean;
}

/** Result of an enqueue. `queued: false` means the backend is unavailable and the
 *  caller should fall back to running the work synchronously (graceful fallback). */
export interface EnqueueResult {
  /** The job id (empty string when not queued). */
  id: string;
  /** Whether the job was actually accepted by the backend. */
  queued: boolean;
}

/** Queue counters — the four required metrics + delayed/paused for completeness. */
export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: number;
}

/** A normalized job handed to a handler. Provider-agnostic view over a BullMQ Job. */
export interface QueueJob<T = unknown> {
  id: string;
  name: string;
  data: T;
  attemptsMade: number;
  opts: JobOptions;
}

/** A handler processes one job. Throw to fail it (subject to retries/backoff). */
export type JobHandler<T = unknown> = (job: QueueJob<T>) => Promise<void>;

/** Handle returned from `process()` — call `close()` to stop the worker. */
export interface WorkerHandle {
  readonly queueName: string;
  close(): Promise<void>;
}

/** The provider-agnostic queue contract. One provider per logical queue name. */
export interface QueueProvider {
  /** Stable provider id surfaced in metrics ("bullmq" | "noop"). */
  readonly id: string;
  /** True when the provider actually accepts jobs. False for the no-op fallback. */
  readonly active: boolean;
  /** The logical queue name this provider is bound to. */
  readonly queueName: string;

  /** Add a job. Returns `{ queued: false }` when the backend is unavailable. */
  enqueue(jobName: string, data: unknown, opts?: JobOptions): Promise<EnqueueResult>;
  /** Move a failed job back to the waiting set for another attempt. */
  retry(jobId: string): Promise<boolean>;
  /** Reschedule a job to run after `delayMs` milliseconds. */
  delay(jobId: string, delayMs: number): Promise<boolean>;
  /** Remove a job (waiting/failed/delayed). No-op if not found. */
  remove(jobId: string): Promise<boolean>;
  /** Snapshot of queue counters. */
  getMetrics(): Promise<QueueMetrics>;
  /** Start a worker. `handler` is invoked per job; `concurrency` is the parallelism. */
  process<T = unknown>(handler: JobHandler<T>, concurrency?: number): WorkerHandle;
  /** Stop the worker + close the producer connection. Idempotent. */
  close(): Promise<void>;
}

/** A point-in-time view of every active queue's provider + counters. */
export interface QueueSnapshotEntry {
  provider: string;
  active: boolean;
  metrics: QueueMetrics;
}
export type QueueSnapshot = Record<string, QueueSnapshotEntry>;