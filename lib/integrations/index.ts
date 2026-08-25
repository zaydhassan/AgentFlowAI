import "server-only";
import { allProviders, getProvider } from "./providers";
import { repository } from "./repository";
import { decodeState, encodeState } from "./state";
import type {
  ActionContext,
  ActionLogEvent,
  ActionResult,
  IntegrationAccount,
  IntegrationProvider,
  IntegrationProviderId,
  IntegrationProviderInfo,
  StoredIntegrationAccount,
} from "./types";

// Re-export the client-safe subset + the facade API.
export type {
  IntegrationAccount,
  IntegrationProviderId,
  IntegrationProviderInfo,
  AccountStatus,
} from "./types";
export { OAUTH_STATE_COOKIE, stateCookieAttributes } from "./state";
export { encryptionConfigured } from "./crypto";

/** Public app URL — prefers NEXT_PUBLIC_APP_URL, then APP_URL, then the request origin. */
export function appUrl(requestUrl: string | URL): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");
  try {
    const u = typeof requestUrl === "string" ? new URL(requestUrl) : requestUrl;
    return `${u.protocol}//${u.host}`;
  } catch {
    return "http://localhost:3000";
  }
}

/** The OAuth callback URL all providers redirect back to. */
export function integrationsCallbackUrl(requestUrl: string | URL): string {
  const override = process.env.GMAIL_OAUTH_REDIRECT_URI;
  if (override) return override.replace(/\/$/, "");
  return `${appUrl(requestUrl)}/api/integrations/callback`;
}

export function getIntegrationProvider(id: string): IntegrationProvider | undefined {
  return getProvider(id);
}

/** Provider summaries for the settings page, each annotated with the user's
 *  connected-account count. */
export async function listProviders(
  userId: string,
): Promise<(IntegrationProviderInfo & { connectedCount: number })[]> {
  const out: (IntegrationProviderInfo & { connectedCount: number })[] = [];
  for (const p of allProviders()) {
    const connectedCount = await repository.countAccounts(userId, p.id);
    out.push({ ...p.info, configured: p.configured, connectedCount });
  }
  return out;
}

export interface StartOAuthArgs {
  providerId: IntegrationProviderId;
  userId: string;
  orgId: string | null;
  returnUrl?: string;
  accountId?: string;
  loginHint?: string | null;
  requestUrl: string | URL;
}

export async function getOAuthStart(args: StartOAuthArgs): Promise<{ authUrl: string; stateValue: string }> {
  const provider = getProvider(args.providerId);
  if (!provider) throw new Error(`Unknown integration provider: ${args.providerId}`);
  if (!provider.configured) {
    throw new Error(`${provider.info.label} is not configured on this environment. Set its credentials in .env.`);
  }
  const redirectUri = integrationsCallbackUrl(args.requestUrl);
  const { authUrl, statePayload } = await provider.startOAuth({
    provider: args.providerId,
    userId: args.userId,
    orgId: args.orgId,
    redirectUri,
    returnUrl: args.returnUrl,
    accountId: args.accountId,
    loginHint: args.loginHint,
  });
  const { value, nonce } = encodeState(statePayload);
  // `nonce` is already embedded as statePayload.nonce AND as the OAuth `state`
  // param inside authUrl (buildAuthUrl sets state=nonce). The cookie binds them.
  void nonce;
  return { authUrl, stateValue: value };
}

export interface CallbackArgs {
  code: string;
  stateNonce: string;
  stateValue: string | undefined | null;
  requestUrl: string | URL;
}

export async function handleOAuthCallback(args: CallbackArgs): Promise<{
  ok: boolean;
  accountId?: string;
  returnUrl?: string;
  error?: string;
}> {
  const payload = decodeState(args.stateValue, args.stateNonce);
  if (!payload) {
    return { ok: false, error: "OAuth state invalid or expired. Please try connecting again." };
  }
  const provider = getProvider(payload.provider);
  if (!provider) return { ok: false, error: `Unknown provider: ${payload.provider}` };

  const redirectUri = integrationsCallbackUrl(args.requestUrl);
  try {
    const { tokenSet, profile } = await provider.exchangeCode(args.code, payload, redirectUri);
    const account = await repository.upsertAccount({
      ownerId: payload.userId,
      orgId: payload.orgId,
      provider: payload.provider,
      providerAccountId: profile.sub,
      profile,
      scopes: payload.scopes,
      tokenSet,
      existingId: payload.accountId,
    });
    return { ok: true, accountId: account.id, returnUrl: payload.returnUrl };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "OAuth code exchange failed." };
  }
}

export async function listAccounts(userId: string, provider?: IntegrationProviderId): Promise<IntegrationAccount[]> {
  return repository.listClientAccounts(userId, provider);
}

/** Disconnect: revoke at the provider (best-effort) + delete the row. */
export async function disconnectAccount(userId: string, accountId: string): Promise<void> {
  const stored = await repository.getStoredOwned(userId, accountId);
  if (!stored) throw new Error("Account not found.");
  const provider = getProvider(stored.provider);
  if (provider) {
    try {
      await provider.revoke(stored);
    } catch {
      // best-effort — we still delete the local row
    }
  }
  await repository.deleteAccount(accountId);
}

/** Re-initiate OAuth for an existing account (re-grant after revocation). */
export async function reconnectStart(
  userId: string,
  accountId: string,
  requestUrl: string | URL,
): Promise<{ authUrl: string; stateValue: string }> {
  const stored = await repository.getStoredOwned(userId, accountId);
  if (!stored) throw new Error("Account not found.");
  return getOAuthStart({
    providerId: stored.provider,
    userId,
    orgId: stored.orgId,
    accountId,
    loginHint: stored.email,
    requestUrl,
  });
}

/** Force a token refresh + status check ("Test connection"). */
export async function refreshAccount(userId: string, accountId: string): Promise<{ status: string }> {
  const stored = await repository.getStoredOwned(userId, accountId);
  if (!stored) throw new Error("Account not found.");
  const provider = getProvider(stored.provider);
  if (!provider) throw new Error("Provider not found.");
  try {
    const tokenSet = await provider.refresh(stored);
    await repository.updateTokens(accountId, tokenSet);
    return { status: "active" };
  } catch (err) {
    const invalidGrant = (err as Error & { invalidGrant?: boolean }).invalidGrant;
    await repository.setStatus(accountId, invalidGrant ? "revoked" : "error");
    throw err instanceof Error ? err : new Error("Refresh failed.");
  }
}

/**
 * Ensure a stored account has a live access token, refreshing + persisting if
 * expired. Mutates the passed account's accessToken/expiresAt in place. Throws
 * on invalid_grant (marks the account revoked).
 */
export async function ensureValidAccessToken(account: StoredIntegrationAccount): Promise<void> {
  const provider = getProvider(account.provider);
  if (!provider) throw new Error(`Provider ${account.provider} not found.`);
  const expired = !account.expiresAt || account.expiresAt.getTime() <= Date.now() + 60_000;
  if (!expired) return;
  try {
    const tokenSet = await provider.refresh(account);
    await repository.updateTokens(account.id, tokenSet);
    account.accessToken = tokenSet.access_token;
    account.expiresAt = new Date(tokenSet.expires_at);
  } catch (err) {
    const invalidGrant = (err as Error & { invalidGrant?: boolean }).invalidGrant;
    if (invalidGrant) await repository.setStatus(account.id, "revoked");
    throw err instanceof Error ? err : new Error("Token refresh failed.");
  }
}

/**
 * Resolve the connected account for a node config + run its action as a
 * streaming async generator. Used by the execution engine's action registry.
 * Throws (→ surfaced as a node failure) if no account is selected/found or the
 * provider is unconfigured. The returned generator yields log events and
 * returns the final ActionResult.
 */
export async function* runIntegrationAction(args: {
  userId: string;
  nodeType: string;
  actionId: string;
  config: Record<string, unknown>;
  inputs: unknown[];
  stopped: () => boolean;
}): AsyncGenerator<ActionLogEvent, ActionResult, unknown> {
  const providerId = args.config.__provider as IntegrationProviderId | undefined;
  // The action registry maps nodeType → provider id + action id; we resolve the
  // account from config.accountId.
  const accountId = typeof args.config.accountId === "string" ? args.config.accountId : undefined;
  void providerId;
  if (!accountId) {
    return {
      status: "failed",
      error: "No Gmail account connected to this node — select one in the node settings (or connect one in Settings → Integrations).",
    };
  }
  const account = await repository.getStoredOwned(args.userId, accountId);
  if (!account) {
    return { status: "failed", error: "The selected Gmail account no longer exists. Re-pick it in the node settings." };
  }
  if (account.status === "revoked") {
    return { status: "failed", error: "The selected Gmail account was revoked. Reconnect it in Settings → Integrations." };
  }
  const provider = getProvider(account.provider);
  if (!provider || !provider.configured) {
    return { status: "failed", error: "Gmail is not configured on this environment. Ask an admin to set GMAIL_OAUTH_CLIENT_*." };
  }

  try {
    yield { type: "log", log: "Authenticating with Gmail…" };
    await ensureValidAccessToken(account);
  } catch (err) {
    return {
      status: "failed",
      error: `Could not authenticate with Gmail: ${err instanceof Error ? err.message : "refresh failed"}. Reconnect the account in Settings → Integrations.`,
    };
  }

  const ctx: ActionContext = {
    nodeType: args.nodeType,
    actionId: args.actionId,
    account,
    config: args.config,
    inputs: args.inputs,
    signal: { stopped: args.stopped },
  };

  // New Email trigger advances the watermark after a successful poll.
  if (args.actionId === "newEmail") {
    const result = yield* provider.runAction(ctx);
    if (result.status === "succeeded" && result.output && typeof result.output === "object") {
      const watermark = (result.output as { watermark?: string }).watermark;
      if (watermark) await repository.updateWatermark(account.id, watermark);
    }
    return result;
  }
  return yield* provider.runAction(ctx);
}