// OAuth state cookie — HMAC-signed, short-lived, HttpOnly. Carries the PKCE
// verifier + which provider/user/account the flow is for, so the callback
// handler is stateless (no server-side session table for pending flows) and
// tamper-proof. The provider puts a random `nonce` into the OAuth `state`
// query param; the cookie binds that nonce to the rest of the payload.
//
// Server-only: signing uses AUTH_SECRET. Routes set/read the cookie via
// NextResponse/Request cookies; this module only produces + verifies the value.

import "server-only";
import crypto from "node:crypto";
import type { OAuthStatePayload } from "./types";

export const OAUTH_STATE_COOKIE = "af_oauth_state";
export const OAUTH_STATE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function secret(): string {
  const s = process.env.AUTH_SECRET;
  if (!s) {
    throw new Error("AUTH_SECRET is required to sign the OAuth state cookie.");
  }
  return s;
}

function sign(payload: string): string {
  return crypto.createHmac("sha256", secret()).update(payload).digest("base64url");
}

/**
 * Encode + sign a state payload into the opaque cookie value
 * `<base64url(json)>.<base64url(hmac)>`. Also returns the bare `nonce` to use
 * as the OAuth `state` query param (so Google echoes back something opaque that
 * the cookie can bind to).
 */
export function encodeState(payload: OAuthStatePayload): { value: string; nonce: string } {
  const json = JSON.stringify(payload);
  const b64 = Buffer.from(json, "utf8").toString("base64url");
  const sig = sign(b64);
  return { value: `${b64}.${sig}`, nonce: payload.nonce };
}

/**
 * Verify a cookie value and return the payload, or null if the signature is
 * invalid, the payload is malformed, or the flow has expired. `nonce` is the
 * value Google echoed back as the `state` query param — it must match.
 */
export function decodeState(value: string | undefined | null, nonce: string | null): OAuthStatePayload | null {
  if (!value || !nonce) return null;
  const dot = value.lastIndexOf(".");
  if (dot < 1) return null;
  const b64 = value.slice(0, dot);
  const sig = value.slice(dot + 1);
  const expected = sign(b64);
  // Constant-time compare to avoid signature-oracle timing leaks.
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
    return null;
  }
  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as OAuthStatePayload;
  } catch {
    return null;
  }
  if (!payload || payload.nonce !== nonce) return null;
  if (typeof payload.issuedAt !== "number" || Date.now() - payload.issuedAt > OAUTH_STATE_TTL_MS) {
    return null;
  }
  return payload;
}

/** Cookie attributes for the state cookie (HttpOnly, SameSite=Lax, short TTL). */
export function stateCookieAttributes(): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAge = Math.round(OAUTH_STATE_TTL_MS / 1000);
  return `Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`;
}