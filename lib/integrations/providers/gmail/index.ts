// GmailProvider — the Gmail implementation of IntegrationProvider. Owns the
// Google OAuth specifics (PKCE consent URL, token exchange/refresh, userinfo,
// revoke) and dispatches node actions to lib/integrations/providers/gmail/actions.
//
// Server-only: the client id/secret never reach the client. The facade
// (lib/integrations/index.ts) handles persistence + token refresh-then-persist;
// this provider is a pure token + API caller.

import "server-only";
import type {
  ActionContext,
  ActionLogEvent,
  ActionResult,
  IntegrationProvider,
  IntegrationProviderInfo,
  OAuthStartRequest,
  OAuthStartResult,
  OAuthStatePayload,
  StoredIntegrationAccount,
  TokenSet,
  UserProfile,
  ProviderActionDef,
} from "../../types";
import { GMAIL_DEFAULT_SCOPES } from "./scopes";
import {
  buildAuthUrl,
  exchangeCode,
  fetchUserinfo,
  gmailClientCredentials,
  gmailConfigured,
  randomUrlSafe,
  refreshAccessToken,
  revokeToken,
} from "./oauth";
import { runGmailAction } from "./actions";

// The actions Gmail exposes as workflow nodes (kept in sync with lib/nodes.ts).
export const GMAIL_ACTIONS: ProviderActionDef[] = [
  { id: "newEmail", nodeType: "gmail.trigger.newEmail", label: "New Email", kind: "trigger" },
  { id: "send", nodeType: "gmail.send", label: "Send Email", kind: "action" },
  { id: "reply", nodeType: "gmail.reply", label: "Reply to Email", kind: "action" },
  { id: "forward", nodeType: "gmail.forward", label: "Forward Email", kind: "action" },
  { id: "search", nodeType: "gmail.search", label: "Search Emails", kind: "action" },
  { id: "read", nodeType: "gmail.read", label: "Read Email", kind: "action" },
  { id: "draft", nodeType: "gmail.draft", label: "Create Draft", kind: "action" },
  { id: "label.add", nodeType: "gmail.label.add", label: "Add Label", kind: "action" },
  { id: "label.remove", nodeType: "gmail.label.remove", label: "Remove Label", kind: "action" },
  { id: "archive", nodeType: "gmail.archive", label: "Archive Email", kind: "action" },
  { id: "markRead", nodeType: "gmail.markRead", label: "Mark as Read", kind: "action" },
  { id: "delete", nodeType: "gmail.delete", label: "Delete Email", kind: "action" },
];

export class GmailProvider implements IntegrationProvider {
  readonly id = "gmail";

  readonly info: Omit<IntegrationProviderInfo, "configured"> = {
    id: "gmail",
    label: "Gmail",
    icon: "Mail",
    color: "#ea4335",
    description: "Send, read, reply, forward, search, label, archive, and trash Gmail messages.",
    scopes: [...GMAIL_DEFAULT_SCOPES],
    actions: GMAIL_ACTIONS,
  };

  get configured(): boolean {
    return gmailConfigured();
  }

  async startOAuth(req: OAuthStartRequest): Promise<OAuthStartResult> {
    // Touch credentials so a misconfig surfaces here with a clear message.
    void gmailClientCredentials();
    const codeVerifier = randomUrlSafe(32);
    const nonce = randomUrlSafe(16);
    const scopes = req.scopes && req.scopes.length ? req.scopes : [...GMAIL_DEFAULT_SCOPES];
    const authUrl = buildAuthUrl({
      redirectUri: req.redirectUri,
      scopes,
      codeVerifier,
      nonce,
      // Reconnect forces a fresh refresh_token; first connect also needs consent
      // for a refresh_token, so forceConsent is always on.
      forceConsent: true,
      loginHint: req.loginHint ?? null,
    });
    const statePayload: OAuthStatePayload = {
      nonce,
      provider: "gmail",
      userId: req.userId,
      orgId: req.orgId,
      returnUrl: req.returnUrl,
      accountId: req.accountId,
      scopes,
      codeVerifier,
      issuedAt: Date.now(),
    };
    return { authUrl, statePayload };
  }

  async exchangeCode(
    code: string,
    state: OAuthStatePayload,
    redirectUri: string,
  ): Promise<{ tokenSet: TokenSet; profile: UserProfile }> {
    const tokenSet = await exchangeCode(code, redirectUri, state.codeVerifier);
    const profile = await fetchUserinfo(tokenSet.access_token);
    return { tokenSet, profile };
  }

  async refresh(account: StoredIntegrationAccount): Promise<TokenSet> {
    if (!account.refreshToken) {
      const err = new Error("No refresh token stored — reconnect the account.") as Error & { invalidGrant?: boolean };
      err.invalidGrant = true;
      throw err;
    }
    return refreshAccessToken(account.refreshToken);
  }

  async revoke(account: StoredIntegrationAccount): Promise<void> {
    // Revoke whichever token we have; best-effort, never throws.
    if (account.accessToken) await revokeToken(account.accessToken);
    else if (account.refreshToken) await revokeToken(account.refreshToken);
  }

  async *runAction(ctx: ActionContext): AsyncGenerator<ActionLogEvent, ActionResult, unknown> {
    return yield* runGmailAction(ctx, ctx.account.accessToken);
  }
}