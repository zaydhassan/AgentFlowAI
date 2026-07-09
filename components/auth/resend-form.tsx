"use client";

import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { resendVerificationAction } from "@/actions/auth";

export function ResendForm({ initialEmail = "" }: { initialEmail?: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setMessage(null);
        setError(null);
        startTransition(async () => {
          const fd = new FormData();
          fd.set("email", email);
          const res = await resendVerificationAction(email);
          if (res?.ok) {
            setMessage(res.message ?? "Sent.");
          } else {
            setError(res?.message ?? "Could not send.");
          }
        });
      }}
      className="space-y-2"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">Email</span>
        <div className="relative">
          <Icon name="Mail" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="h-10 w-full rounded-lg border border-border bg-surface-2 pl-9 pr-3 text-sm text-fg placeholder:text-fg-subtle focus-ring"
          />
        </div>
      </label>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-ai text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
      >
        {pending && (
          <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
        )}
        {pending ? "Sending…" : "Resend verification email"}
      </button>
      {message ? (
        <motion.p
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[11px] text-success"
        >
          <Icon name="CheckCircle2" className="h-3 w-3" /> {message}
        </motion.p>
      ) : null}
      {error ? (
        <motion.p
          initial={{ opacity: 0, y: -2 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-1.5 text-[11px] text-danger"
        >
          <Icon name="AlertCircle" className="h-3 w-3" /> {error}
        </motion.p>
      ) : null}
    </form>
  );
}
