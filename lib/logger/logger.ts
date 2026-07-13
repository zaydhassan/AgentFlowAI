// =============================================================================
// Structured Logging — JSON + pretty backends, async non-blocking sink, factory
// =============================================================================
// Two output backends share one async sink:
//   • JsonBackend   — one JSON object per line (NDJSON), the production format.
//   • PrettyBackend — colored, human-readable lines, the development format.
// Both write to stdout through an async queue that flushes on `setImmediate`,
// so a hot request path never blocks on stdout I/O. `flushLogger()` drains the
// queue (awaitable) — `withRequestLogging` awaits it before returning so logs
// are never dropped by a serverless freeze.
//
// Format + level come from env (LOG_LEVEL, LOG_FORMAT, LOG_PRETTY); a single
// memoized root logger is shared app-wide. Child loggers inherit threshold +
// backend and carry a name (component/module) for filtering.
//
// Server-only (Node).

import "server-only";
import { LOG_LEVELS, type LogContext, type LogData, type LogEntry, type LogFormat, type LogLevel, type Logger } from "./types";
import { getLogContext } from "./context";

// ─────────────────────────── async sink ──────────────────────────────────────
// Bounded queue + setImmediate flush. Non-blocking: callers enqueue a
// pre-formatted line and return immediately. Drops (and counts) new lines only
// if the queue exceeds the cap (backpressure) — never blocks the request.
const MAX_QUEUE = 10_000;
let _queue: string[] = [];
let _scheduled = false;
let _dropped = 0;

function scheduleFlush(): void {
  if (_scheduled) return;
  _scheduled = true;
  setImmediate(flush);
}

function flush(): void {
  _scheduled = false;
  if (_queue.length === 0) return;
  const batch = _queue;
  _queue = [];
  // One write per batch — fewer syscalls, still non-blocking on pipes.
  try {
    process.stdout.write(batch.join("\n") + "\n");
  } catch {
    /* stdout closed (e.g. during shutdown) — drop silently */
  }
}

/** Enqueue a pre-formatted log line. */
function enqueue(line: string): void {
  if (_queue.length >= MAX_QUEUE) {
    _dropped++;
    // Emit a single drop notice every 1000 drops rather than per drop.
    if (_dropped % 1000 === 1) {
      _queue.push(JSON.stringify({ timestamp: nowIso(), level: "warn", message: "log.queue.dropped", dropped: _dropped }));
    }
    return;
  }
  _queue.push(line);
  scheduleFlush();
}

/**
 * Drain the async queue, resolving once buffered lines have been handed to
 * stdout. Await at the end of a request (the withRequestLogging HOC does this)
 * so structured logs survive a serverless freeze.
 */
export function flushLogger(): Promise<void> {
  // Cancel the pending setImmediate and flush synchronously now.
  _scheduled = false;
  flush();
  // process.stdout.write is non-blocking for pipes; awaiting the next macrotask
  // gives libuv a chance to flush its write queue to the kernel.
  return new Promise((resolve) => setImmediate(resolve));
}

// ─────────────────────────── formatting ─────────────────────────────────────
function nowIso(): string {
  return new Date().toISOString();
}

const COLORS: Record<LogLevel, string> = {
  trace: "\x1b[90m", // gray
  debug: "\x1b[36m", // cyan
  info: "\x1b[32m",  // green
  warn: "\x1b[33m",  // yellow
  error: "\x1b[31m", // red
  fatal: "\x1b[35m", // magenta
};
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

/** Flatten context + data, dropping undefined values. */
function flatten(entry: LogEntry): Record<string, unknown> {
  const out: Record<string, unknown> = {
    timestamp: entry.timestamp,
    level: entry.level,
    message: entry.message,
    logger: entry.logger,
    environment: entry.environment,
  };
  for (const [k, v] of Object.entries(entry.context)) if (v !== undefined) out[k] = v;
  for (const [k, v] of Object.entries(entry.data)) if (v !== undefined) out[k] = v;
  return out;
}

/** NDJSON backend — one JSON object per line. */
function formatJson(entry: LogEntry): string {
  return JSON.stringify(flatten(entry));
}

/** Pretty backend — colored, human-readable. */
function formatPretty(entry: LogEntry): string {
  const flat = flatten(entry);
  const ctx: Record<string, unknown> = { ...flat };
  delete ctx.timestamp;
  delete ctx.level;
  delete ctx.message;
  delete ctx.logger;
  delete ctx.environment;
  const ctxStr = Object.keys(ctx).length ? " " + DIM + JSON.stringify(ctx) + RESET : "";
  return (
    `${DIM}${entry.timestamp}${RESET} ` +
    `${COLORS[entry.level]}${entry.level.toUpperCase().padEnd(5)}${RESET} ` +
    `${DIM}[${entry.logger}]${RESET} ` +
    `${entry.message}${ctxStr}`
  );
}

// ─────────────────────────── logger impl ─────────────────────────────────────
class AppLogger implements Logger {
  constructor(readonly name: string, private readonly threshold: number, private readonly format: LogFormat) {}

  child(name: string): Logger {
    // Dot-namespaced children ("app.ai", "app.queue.worker") for filtering.
    return new AppLogger(`${this.name}.${name}`, this.threshold, this.format);
  }

  log(level: LogLevel, message: string, data?: LogData): void {
    if (LOG_LEVELS[level] < this.threshold) return;
    const context: LogContext = getLogContext();
    const entry: LogEntry = {
      timestamp: nowIso(),
      level,
      message,
      logger: this.name,
      environment: context.environment ?? process.env.NODE_ENV ?? "development",
      context,
      data: data ?? {},
    };
    enqueue(this.format === "pretty" ? formatPretty(entry) : formatJson(entry));
  }

  trace(m: string, d?: LogData) { this.log("trace", m, d); }
  debug(m: string, d?: LogData) { this.log("debug", m, d); }
  info(m: string, d?: LogData) { this.log("info", m, d); }
  warn(m: string, d?: LogData) { this.log("warn", m, d); }
  error(m: string, d?: LogData) { this.log("error", m, d); }
  fatal(m: string, d?: LogData) { this.log("fatal", m, d); }
}

// ─────────────────────────── factory ────────────────────────────────────────
let _root: Logger | null = null;

function parseLevel(name: string | undefined, fallback: LogLevel): number {
  const v = (name ?? "").toLowerCase().trim() as LogLevel;
  return LOG_LEVELS[v] ?? LOG_LEVELS[fallback];
}

function resolveFormat(): LogFormat {
  const pretty = (process.env.LOG_PRETTY ?? "").toLowerCase();
  if (pretty === "true") return "pretty";
  if (pretty === "false") return "json";
  const fmt = (process.env.LOG_FORMAT ?? "").toLowerCase();
  if (fmt === "json" || fmt === "pretty") return fmt;
  // Default: pretty in development, JSON in production.
  return (process.env.NODE_ENV ?? "development") === "production" ? "json" : "pretty";
}

/** The shared root logger ("app"). Memoized. */
export function getLogger(name = "app"): Logger {
  if (_root) return name === "app" ? _root : _root.child(name);
  const threshold = parseLevel(process.env.LOG_LEVEL, (process.env.NODE_ENV ?? "development") === "production" ? "info" : "debug");
  _root = new AppLogger(name, threshold, resolveFormat());
  return _root;
}

/** A named child logger (e.g. getLogger("ai"), getLogger("queue.worker")). */
export function createLogger(name: string): Logger {
  return getLogger(name);
}

/** Reset the singleton + async queue — exposed for tests / env hot-reload. */
export function __resetLoggerForTests(): void {
  _root = null;
  _queue = [];
  _scheduled = false;
  _dropped = 0;
}

/** Number of log lines dropped under sink backpressure (observability). */
export function getDroppedCount(): number {
  return _dropped;
}