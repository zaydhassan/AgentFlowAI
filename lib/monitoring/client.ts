import type * as SentryReact from "@sentry/react";
import type {
  MonitoringBreadcrumb,
  MonitoringContext,
  MonitoringLevel,
  MonitoringProvider,
} from "./types";
import { scrubSensitive } from "./sanitizer";

let Sentry: typeof SentryReact | null = null;

async function loadSentry(): Promise<typeof SentryReact> {
  if (!Sentry) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@sentry/react");
    Sentry = (mod.default ?? mod) as typeof SentryReact;
  }
  return Sentry;
}

class ClientSentryProvider implements MonitoringProvider {
  readonly id = "sentry";
  readonly active = true;
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    const s = await loadSentry();
    const release = process.env.NEXT_PUBLIC_SENTRY_RELEASE ?? null;
    const environment =
      process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "production";
    s.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      environment,
      ...(release ? { release } : {}),
      tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
      // Client doesn't install global handlers itself (Next owns the render
      // boundary); keep React's ErrorBoundary etc. available but no auto
      // onUnhandledIntegration double-capture with our own window listeners.
      beforeSend: (event) => scrubSensitive(event),
      sendDefaultPii: false,
      maxBreadcrumbs: 30,
    });
    s.setTag("runtime", "browser");
    this._initialized = true;
  }

  private ensure(): Promise<typeof SentryReact> {
    const s = loadSentry();
    void s.then(() => this.init());
    return s;
  }

  captureException(error: unknown, context?: MonitoringContext): void {
    const captureContext: Record<string, unknown> = {
      ...(context?.userId ? { user: { id: context.userId } } : {}),
      tags: {
        requestId: context?.requestId,
        workflowId: context?.workflowId,
        executionId: context?.executionId,
        agentId: context?.agentId,
        source: context?.source,
      },
      ...(context?.digest ? { contexts: { nextjs: { digest: context.digest } } } : {}),
    };
    this.ensure()
      .then((s) => s.captureException(error, captureContext))
      .catch(() => {});
  }

  captureMessage(
    message: string,
    level: MonitoringLevel = "info",
    context?: MonitoringContext,
  ): void {
    this.ensure()
      .then((s) =>
        s.captureMessage(message, { level, tags: { source: context?.source } }),
      )
      .catch(() => {});
  }

  setUser(user: { id?: string; [key: string]: unknown } | null): void {
    this.ensure()
      .then((s) => s.setUser(user ? { id: user.id } : null))
      .catch(() => {});
  }

  setTag(key: string, value: string | number | boolean): void {
    this.ensure()
      .then((s) => s.setTag(key, String(value)))
      .catch(() => {});
  }

  setContext(key: string, data: Record<string, unknown> | null): void {
    this.ensure()
      .then((s) => s.setContext(key, data ? scrubSensitive(data) : null))
      .catch(() => {});
  }

  addBreadcrumb(breadcrumb: MonitoringBreadcrumb): void {
    this.ensure()
      .then((s) =>
        s.addBreadcrumb({
          level: breadcrumb.level ?? "info",
          message: breadcrumb.message,
          category: breadcrumb.category,
          data: breadcrumb.data ? scrubSensitive(breadcrumb.data) : undefined,
        }),
      )
      .catch(() => {});
  }

  async startSpan<T>(_name: string, _op: string, fn: () => Promise<T>): Promise<T> {
    // Client tracing is optional and ambient (Sentry's browser auto-
    // instrumentation covers fetch/XHR). Keep the API consistent with the
    // server facade so callers don't branch on runtime.
    return fn();
  }

  async flush(timeoutMs?: number): Promise<void> {
    try {
      const s = await loadSentry();
      await s.flush(timeoutMs ?? 2000);
    } catch {}
  }

  async close(): Promise<void> {
    try {
      const s = await loadSentry();
      await s.close(2000);
    } catch {}
  }
}

class NoopClientProvider implements MonitoringProvider {
  readonly id = "noop";
  readonly active = false;
  init(): void {}
  captureException(): void {}
  captureMessage(): void {}
  setUser(): void {}
  setTag(): void {}
  setContext(): void {}
  addBreadcrumb(): void {}
  async startSpan<T>(_n: string, _o: string, fn: () => Promise<T>): Promise<T> {
    return fn();
  }
  async flush(): Promise<void> {}
  async close(): Promise<void> {}
}

let _client: MonitoringProvider | null = null;

function getMonitor(): MonitoringProvider {
  if (_client) return _client;
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  _client = dsn && dsn.trim() ? new ClientSentryProvider() : new NoopClientProvider();
  return _client;
}

/** Capture an unhandled client error (called from app/global-error.tsx). */
export function captureException(error: unknown, context?: MonitoringContext): void {
  try {
    getMonitor().captureException(error, { source: context?.source ?? "client", ...context });
  } catch {}
}

export function captureMessage(
  message: string,
  level: MonitoringLevel = "info",
  context?: MonitoringContext,
): void {
  try {
    getMonitor().captureMessage(message, level, context);
  } catch {}
}

/** Idempotent client init. Safe to call on mount. */
export function initClientMonitoring(): void {
  try {
    void getMonitor().init();
  } catch {}
}