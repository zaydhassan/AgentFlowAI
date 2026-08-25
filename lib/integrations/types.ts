export type IntegrationProviderId = "gmail";

export type AccountStatus = "active" | "expired" | "revoked" | "error";

/** A provider-declared action exposed as a workflow node. */
export interface ProviderActionDef {
  /** Stable action id, e.g. "send", "label.add", "newEmail". */
  id: string;
  /** The workflow node type this action binds to, e.g. "gmail.send". */
  nodeType: string;
  label: string;
  kind: "trigger" | "action";
}

/** Static provider descriptor for the settings page / palette. */
export interface IntegrationProviderInfo {
  id: IntegrationProviderId;
  label: string;
  icon: string; // lucide name
  color: string; // hex accent
  description: string;
  scopes: string[];
  actions: ProviderActionDef[];
  /** True when the provider's env vars are present (so users can connect). */
  configured: boolean;
}

/**
 * CLIENT-SAFE connected-account shape. Returned by every API route that lists
 * accounts. NEVER contains tokens (access/refresh) — those stay server-side.
 */
export interface IntegrationAccount {
  id: string;
  ownerId: string;
  orgId: string | null;
  provider: IntegrationProviderId;
  providerAccountId: string;
  email: string | null;
  label: string;
  scopes: string[];
  status: AccountStatus;
  expiresAt: string | null; // ISO
  connectedAt: string; // ISO
  name: string | null;
  picture: string | null;
}

/**
 * SERVER-ONLY account shape with DECRYPTED plaintext tokens. Lives only in
 * server memory between repository read and provider call; never serialized to
 * a response. `accessToken`/`refreshToken` are plaintext here.
 */
export interface StoredIntegrationAccount {
  id: string;
  ownerId: string;
  orgId: string | null;
  provider: IntegrationProviderId;
  providerAccountId: string;
  email: string | null;
  label: string;
  scopes: string[];
  accessToken: string; // plaintext (decrypted in memory)
  refreshToken: string | null; // plaintext
  expiresAt: Date | null;
  status: AccountStatus;
  name: string | null;
  picture: string | null;
  lastPollHistoryId: string | null;
}

/** OAuth token set returned by the provider's token endpoint. */
export interface TokenSet {
  access_token: string;
  refresh_token: string | null;
  /** Epoch milliseconds when the access token expires. */
  expires_at: number;
  scope: string;
  token_type?: string;
  id_token?: string;
}

/** Normalized user profile from the provider's userinfo endpoint. */
export interface UserProfile {
  sub: string; // provider-stable user id (Google `sub`)
  email: string | null;
  email_verified: boolean;
  name: string | null;
  picture: string | null;
}

/** Request to begin an OAuth flow (connect or reconnect). */
export interface OAuthStartRequest {
  provider: IntegrationProviderId;
  userId: string;
  orgId: string | null;
  /** The OAuth redirect URI the provider must echo back to. */
  redirectUri: string;
  returnUrl?: string;
  /** When reconnecting an existing (e.g. revoked) account. */
  accountId?: string;
  /** Pre-fill the consent screen with this account (used on reconnect). */
  loginHint?: string | null;
  scopes?: string[];
}

/** Result of beginning an OAuth flow: the browser redirects to `authUrl`. */
export interface OAuthStartResult {
  authUrl: string;
  /** The unsigned state payload — the facade signs it (state.ts) into a cookie. */
  statePayload: OAuthStatePayload;
}

/**
 * The signed payload carried in the OAuth state cookie. Recovered on callback
 * to drive code exchange (PKCE verifier) + account upsert (reconnect) +
 * redirect (returnUrl). Has a short TTL (see state.ts).
 */
export interface OAuthStatePayload {
  nonce: string;
  provider: IntegrationProviderId;
  userId: string;
  orgId: string | null;
  returnUrl?: string;
  accountId?: string;
  scopes: string[];
  codeVerifier: string;
  issuedAt: number; // epoch ms
}

/** Result of completing an OAuth callback. */
export interface OAuthCallbackResult {
  ok: boolean;
  accountId?: string;
  error?: string;
}

// Providers execute actions as ASYNC GENERATORS that stream log lines while
// running and RETURN the final ActionResult. The execution engine drains the
// generator, yielding each log as a `node:log` SSE event, then reads the
// returned ActionResult to decide success/failure (feeding the existing retry
// loop). This is what gives Gmail nodes live, streaming execution logs.

export interface ActionLogEvent {
  type: "log";
  log: string;
}

export interface ActionResult {
  status: "succeeded" | "failed";
  /** Structured output forwarded to downstream nodes. */
  output?: unknown;
  error?: string;
  tokensUsed?: number;
  cost?: number;
  /** False for failures that won't be fixed by retrying (auth revoked, no
   *  account selected, provider unconfigured). The engine skips retries then. */
  retryable?: boolean;
}

export interface ActionContext {
  nodeType: string;
  actionId: string;
  /** Resolved connected account with decrypted tokens. */
  account: StoredIntegrationAccount;
  config: Record<string, unknown>;
  /** Outputs of upstream nodes (in edge order). */
  inputs: unknown[];
  /** Cooperative cancellation — checked between API calls. */
  signal: { stopped: () => boolean };
}

/**
 * The single interface the app talks to. Provider implementations live in
 * lib/integrations/providers/{gmail}.ts. The facade (lib/integrations/index.ts)
 * owns the OAuth orchestration: it signs/verifies state (state.ts), persists
 * accounts (repository.ts), and delegates token work + actions to the provider.
 */
export interface IntegrationProvider {
  readonly id: IntegrationProviderId;
  /** Static info minus the runtime `configured` flag (the facade adds that). */
  readonly info: Omit<IntegrationProviderInfo, "configured">;
  /** True when the provider's env vars are present. */
  readonly configured: boolean;

  /** Build the consent URL + the state payload to sign into the cookie. */
  startOAuth(req: OAuthStartRequest): Promise<OAuthStartResult>;

  /** Exchange the authorization code for tokens (uses the PKCE verifier).
   *  `redirectUri` must match the one used to build the consent URL. */
  exchangeCode(code: string, state: OAuthStatePayload, redirectUri: string): Promise<{ tokenSet: TokenSet; profile: UserProfile }>;

  /** Refresh the access token using the stored refresh token. */
  refresh(account: StoredIntegrationAccount): Promise<TokenSet>;

  /** Revoke the account's grants at the provider (best-effort). */
  revoke(account: StoredIntegrationAccount): Promise<void>;

  /** Execute a node action, streaming logs and returning a final result. */
  runAction(ctx: ActionContext): AsyncGenerator<ActionLogEvent, ActionResult, unknown>;
}