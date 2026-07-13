// =============================================================================
// Structured Logging — types
// =============================================================================
// Pure types — runtime-agnostic. The Logger contract every backend module
// programs against. The same logger (getLogger / the default export) is used
// app-wide so request/execution/AI/error context flows consistently.

/** Severity, lowest → highest. Numeric weights gate emission (see LOG_LEVELS). */
export type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

export const LOG_LEVELS: Record<LogLevel, number> = {
  trace: 10,
  debug: 20,
  info: 30,
  warn: 40,
  error: 50,
  fatal: 60,
};

/**
 * Request/execution/AI context auto-attached to every log entry. Propagated
 * across async boundaries via AsyncLocalStorage (lib/logger/context), so a log
 * emitted deep inside a request handler carries the requestId/userId/etc.
 * without threading them manually. Unknown fields are allowed for extras.
 */
export interface LogContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  workflowId?: string;
  executionId?: string;
  agentId?: string;
  nodeId?: string;
  provider?: string;
  environment?: string;
  [key: string]: unknown;
}

/** Structured data passed to a level method. Merged on top of the context. */
export type LogData = Record<string, unknown>;

/** The fully-resolved, serialized log entry (before JSON/string formatting). */
export interface LogEntry {
  timestamp: string; // ISO 8601 (UTC)
  level: LogLevel;
  message: string;
  logger: string; // logger name (component / module)
  environment: string;
  /** Resolved context (request/execution/AI fields). */
  context: LogContext;
  /** Per-call structured data (merged on top). */
  data: LogData;
}

/** Output format. */
export type LogFormat = "json" | "pretty";

/**
 * The Logger every backend module uses. Level methods are fire-and-forget
 * (enqueued on a non-blocking async sink — see lib/logger/logger). `child`
 * returns a named sub-logger that inherits threshold + backend + context.
 */
export interface Logger {
  readonly name: string;
  child(name: string): Logger;
  trace(message: string, data?: LogData): void;
  debug(message: string, data?: LogData): void;
  info(message: string, data?: LogData): void;
  warn(message: string, data?: LogData): void;
  error(message: string, data?: LogData): void;
  fatal(message: string, data?: LogData): void;
  /** Emit at an arbitrary level. No-op when below threshold. */
  log(level: LogLevel, message: string, data?: LogData): void;
}