import "server-only";
import { AsyncLocalStorage } from "async_hooks";
import type { LogContext } from "./types";

const storage = new AsyncLocalStorage<LogContext>();

/** Process-level default context (environment is always known). */
function baseContext(): LogContext {
  return { environment: process.env.NODE_ENV ?? "development" };
}

/**
 * Run `fn` with a merged log context (inherited from the parent context if
 * present, so nested `withLogContext` calls accumulate). Returns fn's result.
 */
export function withLogContext<T>(ctx: Partial<LogContext>, fn: () => T): T {
  const parent = storage.getStore();
  const merged: LogContext = { ...(parent ?? baseContext()), ...ctx };
  return storage.run(merged, fn);
}

/** Async variant — the common case (route handlers are async). */
export async function withLogContextAsync<T>(
  ctx: Partial<LogContext>,
  fn: () => Promise<T>,
): Promise<T> {
  const parent = storage.getStore();
  const merged: LogContext = { ...(parent ?? baseContext()), ...ctx };
  return storage.run(merged, fn);
}

/**
 * Read the active context (falls back to the process default when no scope is
 * active, so logs outside a request still carry `environment`).
 */
export function getLogContext(): LogContext {
  return storage.getStore() ?? baseContext();
}

/**
 * Merge fields into the CURRENT context (mutates the active store). No-op when
 * no scope is active — callers should generally wrap in withLogContext first.
 */
export function setLogContext(ctx: Partial<LogContext>): void {
  const store = storage.getStore();
  if (store) Object.assign(store, ctx);
}

/** Generate a request id (UUIDv4) when the inbound request omits one. */
export function newRequestId(): string {
  return crypto.randomUUID();
}