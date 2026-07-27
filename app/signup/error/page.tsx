"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Icon } from "@/components/ui/icon";
import { friendlyAuthError } from "@/lib/auth/errors";

// Signup error landing — the public /signup/error route declared in auth.config.
// Mirrors /login/error but with sign-up-appropriate copy and a primary "Try
// again" CTA back to /signup.

function ErrorBody() {
  const params = useSearchParams();
  const code = params.get("error");
  const provider = params.get("provider");
  const message = friendlyAuthError(code);
  const providerName = provider === "google" ? "Google" : provider === "github" ? "GitHub" : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5 text-center"
    >
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-danger/10 text-danger">
        <Icon name="ShieldAlert" className="h-6 w-6" />
      </div>
      <div>
        <h1 className="text-lg font-semibold">
          {providerName ? `${providerName} sign-up failed` : "We couldn't create your account"}
        </h1>
        <p className="mt-1.5 text-sm text-fg-muted">{message}</p>
        {code ? <p className="mt-2 text-[11px] text-fg-subtle">Code: {code}</p> : null}
      </div>
      <div className="flex flex-col items-stretch gap-2">
        <Link
          href="/signup"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-brand to-ai text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition-opacity hover:opacity-90"
        >
          Try signing up again
        </Link>
        <Link
          href="/login"
          className="inline-flex h-10 items-center justify-center rounded-lg border border-border text-sm text-fg-muted hover:text-fg"
        >
          Already have an account? Sign in
        </Link>
      </div>
    </motion.div>
  );
}

export default function SignupErrorPage() {
  return (
    <AuthLayout title="" subtitle="" footer={null}>
      <Suspense fallback={null}>
        <ErrorBody />
      </Suspense>
    </AuthLayout>
  );
}