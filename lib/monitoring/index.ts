// =============================================================================
// Error Monitoring — server facade (factory + global handlers + HOCs)
// =============================================================================
// The public surface the rest of the backend imports from `@/lib/monitoring`.
//
// • Factory: `getMonitor()` resolves the active provider from env once and
//   memoizes it. SENTRY_DSN unset → NoopProvider (all ops are cheap no-ops;
//   callers run synchronously). Disabled monitoring must never block the app.
// • Auto-context: `captureException` / `captureMessage` read the request-scoped
//   AsyncLocalStorage (lib/logger/context) and merge it with caller-supplied
//   context, so requestId/userId/workspaceId/workflowId/executionId/agentId/
//   provider are attached to EVERY captured event automatically — callers do
//   not have to thread them. (Logging System's public API; not modified.)
// • Global handlers: `initMonitoring()` installs uncaughtException /
//   unhandledRejection handlers that route through `captureException`. Called
//   once per Node process from instrumentation.ts (the boot hook). Sentry's
//   own GlobalHandlers integration is disabled in the provider to avoid
//   double-capture — these handlers are the single source of truth.
// • HOCs: `withErrorCapture` (route handler) + `withTracing` capture API
//   errors/latency. They are LIBRARY primitives — provided ready to wire but
//   NOT retrofitted into protected systems (per the hard constraints). Wires
//   are additive: opt-in per route.
//
// Server-only (Node runtime).

import "server-only";
import type {
  MonitoringBreadcrumb,
  MonitoringContext,
  MonitoringLevel,
  MonitoringProvider,
} from "./types";
import { getLogger } from "@/lib/logger";
import { getLogContext } from "@/lib/logger/context";
import { SentryProvider } from "./sentry";

export * from "./types";
export { scrubSensitive } from "./sanitizer";
export { resolveRelease } from "./sentry";

const monitorLog = getLogger("monitoring");

// ---------------------------------------------------------------------------
// Noop provider — monitoring disabled. Every op is a cheap no-op so callers
// can stay synchronous and never branch on whether monitoring is on.
// ---------------------------------------------------------------------------
class NoopProvider implements MonitoringProvider {
  readonly id = "noop";
  readonly active = false;
  init(): void {}
  captureException(): void {}
  captureMessage(): void {}
  setUser(): void {}
  setTag(): void {}
  setContext(): void {}
  addBreadcrumb(): void {}
  async startSpan<T>(_name: string, _op: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}

let _monitor: MonitoringProvider | null = null;
let _monitorInitStarted = false;

/** Resolve + memoize the active provider. SENTRY_DSN unset → NoopProvider. */
export function getMonitor(): MonitoringProvider {
  if (_monitor) return _monitor;
  const dsn = process.env.SENTRY_DSN;
  if (dsn && dsn.trim()) {
    _monitor = new SentryProvider();
  } else {
    _monitor = new NoopProvider();
  }
  return _monitor;
}

// ---------------------------------------------------------------------------
// Public capture API — auto-attaches request-scoped context from the logger.
// These never throw. They are safe to call from anywhere in the Node runtime.
// ---------------------------------------------------------------------------
export function captureException(error: unknown, context?: MonitoringContext): void {
  try {
    const m = getMonitor();
    if (!m.active) return;
    const logCtx = getLogContext();
    m.captureException(error, { ...logCtx, ...context });
  } catch (e) {
    monitorLog.warn("monitoring.captureException.failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}

export function captureMessage(
  message: string,
  level: MonitoringLevel = "info",
  context?: MonitoringContext,
): void {
  try {
    const m = getMonitor();
    if (!m.active) return;
    const logCtx = getLogContext();
    m.captureMessage(message, level, { ...logCtx, ...context });
  } catch {
    /* best-effort */
  }
}

export function setUser(user: { id?: string; [key: string]: unknown } | null): void {
  try {
    getMonitor().setUser(user);
  } catch {}
}

export function setTag(key: string, value: string | number | boolean): void {
  try {
    getMonitor().setTag(key, value);
  } catch {}
}

export function setContext(key: string, data: Record<string, unknown> | null): void {
  try {
    getMonitor().setContext(key, data);
  } catch {}
}

export function addBreadcrumb(breadcrumb: MonitoringBreadcrumb): void {
  try {
    getMonitor().addBreadcrumb(breadcrumb);
  } catch {}
}

/** Tracing span. Use for DB/queue/workflow/API latency instrumentation. */
export async function startSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
  const m = getMonitor();
  return m.startSpan(name, op, fn);
}

/** Flush the event buffer (graceful shutdown / serverless freeze). */
export async function flushMonitor(timeoutMs?: number): Promise<void> {
  try {
    await getMonitor().flush(timeoutMs);
  } catch {}
}

export async function closeMonitor(): Promise<void> {
  try {
    await getMonitor().close();
  } catch {}
}

// ---------------------------------------------------------------------------
// Boot — install global uncaughtException / unhandledRejection handlers.
// Called once per Node process from instrumentation.ts. Idempotent + guarded.
// ---------------------------------------------------------------------------
export function initMonitoring(): void {
  const m = getMonitor();
  if (!m.active || _monitorInitStarted) return;
  _monitorInitStarted = true;

  // Init the backend eagerly so the SDK (and its beforeSend scrubber) is
  // ready before the first global handler can fire. Init is lazy-async but we
  // don't await — the first captureException/loadSentry call awaits it.
  void m.init();

  const handle = (kind: string) => (err: unknown) => {
    try {
      monitorLog.error("monitoring.global.unhandled", {
        kind,
        error: err instanceof Error ? err.message : String(err),
      });
      m.captureException(err, { source: "global", tags: { unhandled: kind } });
      // Best-effort flush so the event survives a crashing process.
      void m.flush(2000);
    } catch {
      /* never let monitoring throw */
    }
  };

  try {
    process.on("uncaughtException", handle("uncaughtException"));
    process.on("unhandledRejection", handle("unhandledRejection"));
  } catch {
    /* some runtimes restrict process listeners */
  }
}

// ---------------------------------------------------------------------------
// Route-handler HOCs — library primitives, opt-in. NOT wired into protected
// systems per the constraints; available for any route that wants capture.
// ---------------------------------------------------------------------------

/**
 * Wrap a route handler so unexpected errors are captured (with method/path +
 * auto request context) then re-thrown — Next still returns its 500. The
 * caller's business logic is unchanged; only an additive try/catch wraps it.
 */
export function withErrorCapture<TArgs extends unknown[]>(
  handler: (req: Request, ...args: TArgs) => Promise<Response>,
): (req: Request, ...args: TArgs) => Promise<Response> {
  return async (req: Request, ...args: TArgs) => {
    let path = "";
    try {
      path = new URL(req.url).pathname;
    } catch {}
    try {
      return await handler(req, ...args);
    } catch (err) {
      captureException(err, {
        source: "api",
        tags: { method: req.method, path },
      });
      throw err;
    }
  };
}

/**
 * Wrap a route handler in a tracing span named `http <METHOD>` with the path
 * as a tag — measures API latency. Composes with withErrorCapture.
 */
export function withTracing<TArgs extends unknown[]>(
  handler: (req: Request, ...args: TArgs) => Promise<Response>,
): (req: Request, ...args: TArgs) => Promise<Response> {
  return async (req: Request, ...args: TArgs) => {
    let path = "";
    try {
      path = new URL(req.url).pathname;
    } catch {}
    return startSpan(`http ${req.method}`, "http", async () => {
      try {
        const res = await handler(req, ...args);
        addBreadcrumb({
          level: "info",
          category: "http",
          message: `${req.method} ${path} → ${res.status}`,
        });
        return res;
      } catch (err) {
        addBreadcrumb({
          level: "error",
          category: "http",
          message: `${req.method} ${path} → 500`,
        });
        throw err;
      }
    });
  };
}

/** Test-only: reset the singleton + init flag. */
export function __resetMonitoringForTests(): void {
  _monitor = null;
  _monitorInitStarted = false;
}