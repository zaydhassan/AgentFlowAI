"use client";

import { signIn } from "next-auth/react";
import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { FRIENDLY_OAUTH_ERRORS } from "@/lib/auth/errors";

type Provider = "google" | "github";

export function OAuthButtons({
  callbackUrl = "/",
  providers,
}: {
  callbackUrl?: string;
  providers: { google: boolean; github: boolean };
}) {
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<Provider | null>(null);

  const startOAuth = (provider: Provider) => {
    if (!providers[provider]) {
      window.location.assign(`/login/error?error=${encodeURIComponent("notConfigured")}&provider=${provider}`);
      return;
    }
    setBusy(provider);
    startTransition(async () => {
      try {
        const res = await signIn(provider, { callbackUrl, redirect: false });
        if (res?.url) {
          window.location.href = res.url;
        } else if (res?.error) {
          window.location.assign(`/login/error?error=${encodeURIComponent(res.error)}&provider=${provider}`);
        }
      } catch {
        window.location.assign(`/login/error?error=Unknown&provider=${provider}`);
      } finally {
        setBusy(null);
      }
    });
  };

  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <button
        type="button"
        onClick={() => startOAuth("google")}
        disabled={pending || !providers.google}
        aria-busy={busy === "google"}
        title={!providers.google ? FRIENDLY_OAUTH_ERRORS.notConfigured : undefined}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm font-medium transition-colors hover:bg-surface-3 disabled:opacity-60"
      >
        {busy === "google" ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" aria-hidden />
        ) : (
          <Icon name="Chrome" className="h-4 w-4" />
        )}
        Continue with Google
      </button>
      <button
        type="button"
        onClick={() => startOAuth("github")}
        disabled={pending || !providers.github}
        aria-busy={busy === "github"}
        title={!providers.github ? FRIENDLY_OAUTH_ERRORS.notConfigured : undefined}
        className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm font-medium transition-colors hover:bg-surface-3 disabled:opacity-60"
      >
        {busy === "github" ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-fg-subtle border-t-transparent" aria-hidden />
        ) : (
          <Icon name="Github" className="h-4 w-4" />
        )}
        Continue with GitHub
      </button>
    </div>
  );
}
