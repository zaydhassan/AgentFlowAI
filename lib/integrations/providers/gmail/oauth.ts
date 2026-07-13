// Gmail OAuth low-level: PKCE, consent URL, token exchange/refresh, userinfo,
// revoke. Pure fetch against Google endpoints — no SDK (matches the lib/ai
// REST-direct philosophy). Server-only: client id/secret never reach the client.

import "server-only";
import crypto from "node:crypto";
import type { TokenSet, UserProfile } from "../../types";
import {
  GMAIL_CLIENT_ID_ENV,
  GMAIL_CLIENT_SECRET_ENV,
  GOOGLE_AUTH_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  GOOGLE_REVOKE_URL,
} from "./scopes";

// ─────────────────────────── env helpers ────────────────────────────────────

export function gmailClientCredentials(): { clientId: string; clientSecret: string } {
  const clientId = process.env[GMAIL_CLIENT_ID_ENV];
  const clientSecret = process.env[GMAIL_CLIENT_SECRET_ENV];
  if (!clientId || !clientSecret) {
    throw new Error(
      "Gmail OAuth is not configured. Set GMAIL_OAUTH_CLIENT_ID and GMAIL_OAUTH_CLIENT_SECRET in .env.",
    );
  }
  return { clientId, clientSecret };
}

export function gmailConfigured(): boolean {
  return Boolean(process.env[GMAIL_CLIENT_ID_ENV] && process.env[GMAIL_CLIENT_SECRET_ENV]);
}

// ─────────────────────────── PKCE ───────────────────────────────────────────

/** Random URL-safe string (RFC 7636 verifier / nonce). */
export function randomUrlSafe(bytes = 32): string {
  return crypto.randomBytes(bytes).toString("base64url");
}

/** S256 code_challenge = base64url(sha256(verifier)). */
export function codeChallengeS256(verifier: string): string {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// ─────────────────────────── consent URL ───────────────────────────────────

export interface BuildAuthUrlArgs {
  redirectUri: string;
  scopes: string[];
  codeVerifier: string;
  nonce: string;
  /** Force consent (reconnect) so Google returns a fresh refresh_token. */
  forceConsent?: boolean;
  /** Login hint — pre-fill the account email. */
  loginHint?: string | null;
}

export function buildAuthUrl(args: BuildAuthUrlArgs): string {
  const { clientId } = gmailClientCredentials();
  const challenge = codeChallengeS256(args.codeVerifier);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: args.scopes.join(" "),
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: args.nonce,
    access_type: "offline", // request a refresh_token
    include_granted_scopes: "true",
  });
  if (args.forceConsent) {
    params.set("prompt", "consent"); // forces a fresh refresh_token on reconnect
  } else {
    params.set("prompt", "consent"); // first connect also needs consent to get a refresh_token
  }
  if (args.loginHint) params.set("login_hint", args.loginHint);
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

// ─────────────────────────── token endpoint ─────────────────────────────────

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
}

function toTokenSet(t: GoogleTokenResponse): TokenSet {
  if (!t.access_token) {
    throw new Error(t.error_description || t.error || "Google token endpoint returned no access_token");
  }
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? null,
    expires_at: Date.now() + (typeof t.expires_in === "number" ? t.expires_in * 1000 : 3600 * 1000),
    scope: t.scope ?? "",
    token_type: t.token_type,
    id_token: t.id_token,
  };
}

export async function exchangeCode(code: string, redirectUri: string, codeVerifier: string): Promise<TokenSet> {
  const { clientId, clientSecret } = gmailClientCredentials();
  const body = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
    code_verifier: codeVerifier,
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) {
    throw new Error(json.error_description || json.error || `Google token exchange failed (${res.status})`);
  }
  return toTokenSet(json);
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenSet> {
  const { clientId, clientSecret } = gmailClientCredentials();
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
  });
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const json = (await res.json().catch(() => ({}))) as GoogleTokenResponse;
  if (!res.ok || !json.access_token) {
    const msg = json.error_description || json.error || `Google token refresh failed (${res.status})`;
    const err = new Error(msg) as Error & { invalidGrant?: boolean };
    if (json.error === "invalid_grant") err.invalidGrant = true;
    throw err;
  }
  const set = toTokenSet(json);
  // Google does not return a new refresh_token on refresh — keep the old one.
  set.refresh_token = set.refresh_token ?? refreshToken;
  return set;
}

// ─────────────────────────── userinfo + revoke ──────────────────────────────

interface GoogleUserinfo {
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
}

export async function fetchUserinfo(accessToken: string): Promise<UserProfile> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Google userinfo fetch failed (${res.status})`);
  }
  const u = (await res.json().catch(() => ({}))) as GoogleUserinfo;
  if (!u.sub) throw new Error("Google userinfo returned no subject (sub)");
  return {
    sub: u.sub,
    email: u.email ?? null,
    email_verified: typeof u.email_verified === "string" ? u.email_verified === "true" : Boolean(u.email_verified),
    name: u.name ?? null,
    picture: u.picture ?? null,
  };
}

/** Best-effort revoke of the token's grants at Google. Never throws (caller
 *  proceeds to delete the local row regardless). */
export async function revokeToken(token: string): Promise<void> {
  try {
    await fetch(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(token)}`, { method: "POST" });
  } catch {
    // best-effort
  }
}

// ─────────────────────────── encoding helpers ───────────────────────────────

/** base64url encode (used for Gmail message raw payloads). */
export function base64UrlEncode(buf: Buffer | string): string {
  const b = typeof buf === "string" ? Buffer.from(buf, "utf8") : buf;
  return b.toString("base64url");
}

/** base64url decode. */
export function base64UrlDecode(s: string): Buffer {
  return Buffer.from(s, "base64url");
}