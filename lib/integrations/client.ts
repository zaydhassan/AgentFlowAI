"use client";

// Client-safe integrations helper. The only thing the browser needs to do is
// kick off a connect/reconnect flow (the server returns the Google consent URL
// + sets the state cookie, and we just redirect). Re-exports the client-safe
// types for components.

import type { IntegrationAccount, IntegrationProviderId, IntegrationProviderInfo } from "./types";

export type { IntegrationAccount, IntegrationProviderId, IntegrationProviderInfo };

/**
 * Start a connect (or reconnect) flow. POSTs to /api/integrations/connect and
 * redirects the browser to the provider's consent URL. On reconnect, pass the
 * existing account id.
 */
export async function connectProvider(
  provider: IntegrationProviderId,
  opts?: { returnUrl?: string; accountId?: string },
): Promise<void> {
  const res = await fetch("/api/integrations/connect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, returnUrl: opts?.returnUrl, accountId: opts?.accountId }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Could not start ${provider} connect (${res.status}).`);
  }
  const { authUrl } = (await res.json()) as { authUrl: string };
  window.location.href = authUrl;
}

/** Disconnect a connected account (revoke + delete). */
export async function disconnectAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/integrations/accounts/${accountId}`, { method: "DELETE" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Could not disconnect (${res.status}).`);
  }
}

/** Re-initiate OAuth for an existing (e.g. revoked) account. Redirects to consent. */
export async function reconnectAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/integrations/accounts/${accountId}/reconnect`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Could not start reconnect (${res.status}).`);
  }
  const { authUrl } = (await res.json()) as { authUrl: string };
  window.location.href = authUrl;
}

/** Force a token refresh / connection test. */
export async function refreshAccount(accountId: string): Promise<void> {
  const res = await fetch(`/api/integrations/accounts/${accountId}/refresh`, { method: "POST" });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error ?? `Connection test failed (${res.status}).`);
  }
}