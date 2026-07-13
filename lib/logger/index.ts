// =============================================================================
// Structured Logging — facade + request/execution/AI/error log helpers
// =============================================================================
// The public surface every backend module imports from `@/lib/logger`. The
// shared logger (getLogger) + AsyncLocalStorage context (lib/logger/context)
// + non-blocking async sink (lib/logger/logger) make structured logging
// available app-wide with automatic request-scoped context.
//
// The `logRequest` / `logExecution` / `logAiCall` / `logError` helpers emit the
// canonical structured events for each category. `withRequestLogging` wraps a
// Next.js route handler: it opens a request context (requestId), logs the
// incoming request, measures duration + status + response size, logs the
// completed request (or error), and flushes the async sink before returning —
// so no log is lost to a serverless freeze.
//
// Server-only (Node). Not wired into any existing route: every route in this
// app belongs to a protected system (workflows / ai / memory / mcp / auth /
// payments / integrations / queue), so retrofitting the HOC there is out of
// scope per the constraints. It's provided ready to drop in:
//   export const POST = withRequestLogging(async (req) => { ... });
//
// Server-only.

import "server-only";
import { flushLogger, getDroppedCount, getLogger as getRootLogger } from "./logger";
import { newRequestId, withLogContextAsync } from "./context";
export type {
  LogContext,
  LogData,
  LogEntry,
  LogFormat,
  LogLevel,
  Logger,
} from "./types";
export { LOG_LEVELS } from "./types";
export {
  getLogContext,
  newRequestId,
  setLogContext,
  withLogContext,
  withLogContextAsync,
} from "./context";
export { createLogger, flushLogger, getDroppedCount, getLogger } from "./logger";

// The default shared logger — import { logger } from "@/lib/logger".
export const logger = getRootLogger("app");

// ─────────────────────────── error normalization ─────────────────────────────
/** Capture an error's structured form: type, message, stack, and cause chain. */
export function normalizeError(err: unknown): Record<string, unknown> {
  if (err instanceof Error) {
    const out: Record<string, unknown> = {
      error: {
        type: err.name,
        message: err.message,
        stack: err.stack,
      },
    };
    // AggregateErrors + ES2022 `cause` chains.
    const cause = (err as { cause?: unknown }).cause;
    if (cause !== undefined) out.error = { ...(out.error as object), cause: normalizeError(cause) };
    const errors = (err as { errors?: unknown[] }).errors;
    if (Array.isArray(errors)) out.error = { ...(out.error as object), errors: errors.map(normalizeError) };
    return out;
  }
  return { error: { type: typeof err, value: String(err) } };
}

// ─────────────────────────── request logging ────────────────────────────────
export interface RequestLogFields {
  method: string;
  path: string;
  status?: number;
  durationMs?: number;
  responseSize?: number;
  requestId?: string;
  error?: unknown;
}

/** Log an incoming request (pre-response). */
export function logRequestIncoming(l: ReturnType<typeof getRootLogger>, f: RequestLogFields): void {
  l.debug("request.incoming", { http: { method: f.method, path: f.path }, requestId: f.requestId });
}

/** Log a completed request (post-response) with duration, status, size, error. */
export function logRequestCompleted(l: ReturnType<typeof getRootLogger>, f: RequestLogFields): void {
  const data: Record<string, unknown> = {
    http: {
      method: f.method,
      path: f.path,
      status: f.status,
      durationMs: f.durationMs,
      responseSize: f.responseSize,
    },
    requestId: f.requestId,
  };
  if (f.error !== undefined) Object.assign(data, normalizeError(f.error));
  const level = f.status && f.status >= 500 ? "error" : "info";
  l.log(level, "request.completed", data);
}

// ─────────────────────────── execution logging ───────────────────────────────
export interface ExecutionLogFields {
  event: "started" | "completed" | "failed";
  workflowId?: string;
  executionId?: string;
  durationMs?: number;
  retryCount?: number;
  queueLatencyMs?: number;
  error?: unknown;
}

/** Log a workflow-execution lifecycle event. */
export function logExecution(l: ReturnType<typeof getRootLogger>, f: ExecutionLogFields): void {
  const data: Record<string, unknown> = {
    workflow: { id: f.workflowId, executionId: f.executionId, event: f.event },
    durationMs: f.durationMs,
    retry: { count: f.retryCount, queueLatencyMs: f.queueLatencyMs },
  };
  if (f.error !== undefined) Object.assign(data, normalizeError(f.error));
  l.log(f.event === "failed" ? "error" : f.event === "started" ? "info" : "info", `workflow.${f.event}`, data);
}

// ─────────────────────────── AI logging ──────────────────────────────────────
export interface AiLogFields {
  event?: "ai.call" | "memory.retrieval" | "mcp.invocation";
  model?: string;
  provider?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs?: number;
  cacheHit?: boolean;
  /** memory.retrieval */
  memoryHits?: number;
  memoryTopK?: number;
  /** mcp.invocation */
  mcpServer?: string;
  mcpTool?: string;
  error?: unknown;
}

/** Log an AI call (model, provider, token usage, latency, cache hit/miss). */
export function logAiCall(l: ReturnType<typeof getRootLogger>, f: AiLogFields): void {
  const data: Record<string, unknown> = {
    ai: {
      model: f.model,
      provider: f.provider,
      tokens: {
        prompt: f.promptTokens,
        completion: f.completionTokens,
        total: f.totalTokens,
      },
      latencyMs: f.latencyMs,
      cacheHit: f.cacheHit,
    },
  };
  if (f.error !== undefined) Object.assign(data, normalizeError(f.error));
  l.log(f.error !== undefined ? "error" : "info", f.event ?? "ai.call", data);
}

/** Log a memory-retrieval event (retrieved by an AI/memory node). */
export function logMemoryRetrieval(l: ReturnType<typeof getRootLogger>, f: AiLogFields): void {
  const data: Record<string, unknown> = {
    memory: { hits: f.memoryHits, topK: f.memoryTopK, latencyMs: f.latencyMs },
    provider: f.provider,
  };
  if (f.error !== undefined) Object.assign(data, normalizeError(f.error));
  l.log(f.error !== undefined ? "error" : "debug", "memory.retrieval", data);
}

/** Log an MCP tool invocation. */
export function logMcpInvocation(l: ReturnType<typeof getRootLogger>, f: AiLogFields): void {
  const data: Record<string, unknown> = {
    mcp: { server: f.mcpServer, tool: f.mcpTool, latencyMs: f.latencyMs },
    provider: f.provider,
  };
  if (f.error !== undefined) Object.assign(data, normalizeError(f.error));
  l.log(f.error !== undefined ? "error" : "info", "mcp.invocation", data);
}

// ─────────────────────────── error logging ───────────────────────────────────
export interface ErrorLogFields {
  /** The thrown value — its stack/type/cause are captured. */
  error: unknown;
  /** Extra request context (already-propagated context is attached automatically). */
  context?: Record<string, unknown>;
  /** Retry information: attempt number + whether it'll be retried. */
  retry?: { attempt: number; willRetry: boolean; maxAttempts?: number };
}

/** Log an error with stack trace, request context, error type, cause, retry. */
export function logError(l: ReturnType<typeof getRootLogger>, f: ErrorLogFields): void {
  const data: { context?: Record<string, unknown>; retry?: Record<string, unknown> } & Record<string, unknown> = {};
  if (f.context) data.context = f.context;
  if (f.retry) data.retry = f.retry;
  Object.assign(data, normalizeError(f.error));
  l.error("error.unhandled", data);
}

// ─────────────────────────── request HOC ─────────────────────────────────────
/**
 * Wrap a Next.js App Router route handler (Node runtime) with request logging.
 * Opens a request context (requestId from `x-request-id` or generated), logs
 * the incoming request, times the handler, logs the completed request (status,
 * duration, response size) or the error, and flushes the async sink before
 * returning so logs survive a serverless freeze.
 *
 *   export const POST = withRequestLogging(async (req, ctx) => {
 *     ctx.logger.info("doing work");
 *     return Response.json({ ok: true });
 *   });
 */
export function withRequestLogging<TArgs extends unknown[]>(
  handler: (
    req: Request,
    ctx: { logger: ReturnType<typeof getRootLogger>; requestId: string },
    ...args: TArgs
  ) => Promise<Response>,
): (req: Request, ...args: TArgs) => Promise<Response> {
  return async (req: Request, ...args: TArgs) => {
    const requestId = req.headers.get("x-request-id") ?? newRequestId();
    const url = new URL(req.url);
    const method = req.method;
    const path = url.pathname;
    return withLogContextAsync({ requestId, path }, async () => {
      const rl = getRootLogger("http");
      logRequestIncoming(rl, { method, path, requestId });
      const start = Date.now();
      try {
        const res = await handler(req, { logger: rl.child("route"), requestId }, ...args);
        const durationMs = Date.now() - start;
        const sizeHeader = res.headers.get("content-length");
        logRequestCompleted(rl, {
          method,
          path,
          status: res.status,
          durationMs,
          responseSize: sizeHeader ? Number(sizeHeader) : undefined,
          requestId,
        });
        await flushLogger();
        return res;
      } catch (err) {
        const durationMs = Date.now() - start;
        logRequestCompleted(rl, { method, path, status: 500, durationMs, error: err, requestId });
        await flushLogger();
        throw err;
      }
    });
  };
}

/** Number of log lines dropped under sink backpressure (observability). */
export function loggerDroppedCount(): number {
  return getDroppedCount();
}