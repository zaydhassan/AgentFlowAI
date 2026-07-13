// GET /api/integrations/callback — the OAuth redirect target. Google sends back
// ?code=&state= (or ?error=). Verifies the state cookie, exchanges the code,
// persists the account, and redirects to the settings page (or returnUrl).
// Clears the state cookie on the way out.

import { NextResponse } from "next/server";
import { handleOAuthCallback, OAUTH_STATE_COOKIE } from "@/lib/integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateNonce = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  const stateValue = req.headers.get("cookie")?.match(new RegExp(`${OAUTH_STATE_COOKIE}=([^;]+)`))?.[1];

  const settingsUrl = `${url.origin}/settings/integrations`;

  if (oauthError) {
    // e.g. user clicked "Cancel" on the consent screen → access_denied.
    const res = NextResponse.redirect(`${settingsUrl}?error=${encodeURIComponent(oauthError)}`);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }
  if (!code || !stateNonce) {
    const res = NextResponse.redirect(`${settingsUrl}?error=missing_code`);
    res.cookies.delete(OAUTH_STATE_COOKIE);
    return res;
  }

  const result = await handleOAuthCallback({
    code,
    stateNonce,
    stateValue,
    requestUrl: req.url,
  });

  const dest = result.ok
    ? result.returnUrl && /^\/(?!\/)/.test(result.returnUrl)
      ? `${url.origin}${result.returnUrl}`
      : `${settingsUrl}?connected=1`
    : `${settingsUrl}?error=${encodeURIComponent(result.error ?? "callback_failed")}`;

  const res = NextResponse.redirect(dest);
  res.cookies.delete(OAUTH_STATE_COOKIE);
  return res;
}