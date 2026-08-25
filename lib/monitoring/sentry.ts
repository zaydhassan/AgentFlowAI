import "server-only";
import type * as SentryNode from "@sentry/node";
import type {
  MonitoringBreadcrumb,
  MonitoringContext,
  MonitoringLevel,
  MonitoringProvider,
  MonitoringRelease,
} from "./types";
import { scrubSensitive } from "./sanitizer";

const FILTERED = "[Filtered]";

let Sentry: typeof SentryNode | null = null;

async function loadSentry(): Promise<typeof SentryNode> {
  if (!Sentry) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod: any = await import("@sentry/node");
    Sentry = (mod.default ?? mod) as typeof SentryNode;
  }
  return Sentry;
}

/** Resolve release metadata once at init. Reads SENTRY_RELEASE / APP_VERSION / GIT_SHA / NODE_ENV. */
export function resolveRelease(): MonitoringRelease {
  const version = process.env.APP_VERSION ?? "0.1.0";
  const release = process.env.SENTRY_RELEASE ?? version;
  const gitSha = process.env.GIT_SHA ?? (process.env.SENTRY_RELEASE ?? null);
  const environment =
    process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV ?? "development";
  return { version, release, gitSha, environment };
}

/** Map MonitoringContext → Sentry's CaptureContext (a partial ScopeContext). */
function toCaptureContext(
  ctx: MonitoringContext | undefined,
): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const tags: Record<string, string> = {};
  // Promote the structured context fields to a dedicated "agentflow" context +
  // individual tags so they're filterable in the Sentry UI.
  const af: Record<string, unknown> = {};
  for (const key of [
    "requestId",
    "workspaceId",
    "workflowId",
    "executionId",
    "agentId",
    "nodeId",
    "provider",
    "source",
    "digest",
  ] as const) {
    const v = (ctx as Record<string, unknown>)[key];
    if (v !== undefined && v !== null) {
      af[key] = v;
      // Indexed tags too (Sentry indexes tags; contexts are not indexed). The
      // digest is high-cardinality → keep it in context only, not as a tag.
      if (key !== "digest") tags[key] = String(v);
    }
  }
  if (ctx.tags) {
    for (const [k, v] of Object.entries(ctx.tags)) tags[k] = String(v);
  }
  const captureContext: Record<string, unknown> = {
    ...(ctx.userId ? { user: { id: ctx.userId } } : {}),
    ...(Object.keys(tags).length ? { tags } : {}),
    ...(Object.keys(af).length ? { contexts: { agentflow: af } } : {}),
    ...(ctx.extra && Object.keys(ctx.extra).length
      ? { extra: scrubSensitive(ctx.extra) }
      : {}),
  };
  return captureContext;
}

export class SentryProvider implements MonitoringProvider {
  readonly id = "sentry";
  readonly active = true;
  private _initialized = false;

  async init(): Promise<void> {
    if (this._initialized) return;
    const s = await loadSentry();
    const release = resolveRelease();
    s.init({
      dsn: process.env.SENTRY_DSN,
      environment: release.environment,
      release: release.release,
      tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
      // We own global handlers ourselves (provider-agnostic); drop Sentry's
      // built-in GlobalHandlers to avoid double-capture.
      integrations: (defaults) =>
        defaults.filter((i) => (i as { name?: string }).name !== "GlobalHandlers"),
      // Single sanitization chokepoint: scrub the whole event before send.
      // scrubSensitive<T>(input:T):T preserves the event subtype (ErrorEvent).
      beforeSend: (event) => scrubSensitive(event),
      // Never send request bodies/cookies/pii that the SDK auto-attaches raw.
      sendDefaultPii: false,
      // Serverless-friendly: flush aggressively; the facade flush() is also
      // available to callers on graceful shutdown / freeze.
      maxBreadcrumbs: 50,
    });
    s.setTag("app.version", release.version);
    if (release.gitSha) s.setTag("git.sha", release.gitSha);
    s.setTag("runtime", "node");
    this._initialized = true;
  }

  captureException(error: unknown, context?: MonitoringContext): void {
    loadSentry()
      .then((s) => {
        s.captureException(error, toCaptureContext(context));
      })
      .catch(() => {
        /* best-effort; never throw from monitoring */
      });
  }

  captureMessage(
    message: string,
    level: MonitoringLevel = "info",
    context?: MonitoringContext,
  ): void {
    loadSentry()
      .then((s) => {
        const ctx = toCaptureContext(context);
        s.captureMessage(message, { level, ...(ctx ?? {}) });
      })
      .catch(() => {
        /* best-effort */
      });
  }

  setUser(user: { id?: string; [key: string]: unknown } | null): void {
    loadSentry()
      .then((s) => {
        // Send only the stable id — email/name/etc. are PII; never exfiltrate.
        s.setUser(user && user.id ? { id: user.id } : null);
      })
      .catch(() => {});
  }

  setTag(key: string, value: string | number | boolean): void {
    loadSentry()
      .then((s) => s.setTag(key, String(value)))
      .catch(() => {});
  }

  setContext(key: string, data: Record<string, unknown> | null): void {
    loadSentry()
      .then((s) => s.setContext(key, data ? scrubSensitive(data) : null))
      .catch(() => {});
  }

  addBreadcrumb(breadcrumb: MonitoringBreadcrumb): void {
    loadSentry()
      .then((s) => {
        s.addBreadcrumb({
          level: breadcrumb.level ?? "info",
          message: breadcrumb.message,
          category: breadcrumb.category,
          data: breadcrumb.data ? scrubSensitive(breadcrumb.data) : undefined,
        });
      })
      .catch(() => {});
  }

  async startSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T> {
    const s = await loadSentry();
    return s.startSpan({ name, op }, async () => fn());
  }

  async flush(timeoutMs?: number): Promise<void> {
    try {
      const s = await loadSentry();
      await s.flush(timeoutMs ?? 2000);
    } catch {
      /* best-effort */
    }
  }

  async close(): Promise<void> {
    try {
      const s = await loadSentry();
      await s.close(2000);
    } catch {
      /* best-effort */
    }
  }
}

/** Re-exported for tests / inspection. */
export { loadSentry };
export const FILTERED_VALUE = FILTERED;