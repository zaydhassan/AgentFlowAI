/** Severity mirrors Sentry levels but is owned by this interface, not Sentry. */
export type MonitoringLevel = "fatal" | "error" | "warning" | "info" | "debug";

/**
 * Context attached to a captured event. All optional — populated from the
 * request-scoped AsyncLocalStorage (lib/logger/context) at capture time and
 * merged with caller-supplied context. These are the ONLY fields guaranteed
 * to be sanitized of secrets before leaving the process (see sanitizer.ts).
 */
export interface MonitoringContext {
  requestId?: string;
  userId?: string;
  workspaceId?: string;
  workflowId?: string;
  executionId?: string;
  agentId?: string;
  nodeId?: string;
  provider?: string;
  /** Subsystem the event originated in (api/workflow/agent/queue/redis/db/webhook/mcp/memory). */
  source?: string;
  /** Error digest (e.g. Next.js' global-error digest). */
  digest?: string;
  /** Structured tags (indexed/filterable in the provider UI). */
  tags?: Record<string, string | number | boolean>;
  /** Arbitrary structured data attached to the event. */
  extra?: Record<string, unknown>;
}

/** A structured breadcrumb (audit trail leading up to an event). */
export interface MonitoringBreadcrumb {
  level?: MonitoringLevel;
  message: string;
  category?: string;
  data?: Record<string, unknown>;
  /** Epoch ms. Caller may omit; provider stamps it. */
  timestamp?: number;
}

/**
 * The provider contract. Implementations: SentryProvider (server, @sentry/node),
 * ClientSentryProvider (browser, @sentry/react), NoopProvider (disabled).
 * `id` identifies the active backend; `active` is false for the noop.
 */
export interface MonitoringProvider {
  readonly id: string;
  readonly active: boolean;
  /** Initialize the backend (SDK init). Idempotent. */
  init(): Promise<void> | void;
  /** Capture an exception. Never throws — monitoring is best-effort. */
  captureException(error: unknown, context?: MonitoringContext): void;
  /** Capture a plain message at the given level. Never throws. */
  captureMessage(message: string, level?: MonitoringLevel, context?: MonitoringContext): void;
  /** Associate the active user with subsequent events. */
  setUser(user: { id?: string; [key: string]: unknown } | null): void;
  /** Set a global tag (persists for the process / session). */
  setTag(key: string, value: string | number | boolean): void;
  /** Attach structured context (e.g. "trace" / "feature_flags"). */
  setContext(key: string, data: Record<string, unknown> | null): void;
  /** Append a breadcrumb to the trail. */
  addBreadcrumb(breadcrumb: MonitoringBreadcrumb): void;
  /**
   * Run `fn` inside a tracing span (perf timing). Returns fn's result.
   * Callers use this for request/DB/queue/workflow latency instrumentation.
   */
  startSpan<T>(name: string, op: string, fn: () => Promise<T>): Promise<T>;
  /** Flush the event buffer (awaitable; call on graceful shutdown / serverless freeze). */
  flush(timeoutMs?: number): Promise<void>;
  /** Close the backend and release resources. */
  close(): Promise<void>;
}

/** Release/identification metadata resolved at init and stamped on every event. */
export interface MonitoringRelease {
  /** Application version (APP_VERSION / package.json). */
  version: string;
  /** Sentry release id (SENTRY_RELEASE) — may be the git commit SHA or version@sha. */
  release: string;
  /** Git commit SHA if available (GIT_SHA or SENTRY_RELEASE when it's a SHA). */
  gitSha: string | null;
  /** Deployment environment. */
  environment: string;
}