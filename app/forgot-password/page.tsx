"use client";

import { useState, useActionState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Icon } from "@/components/ui/icon";
import { forgotPasswordAction, type AuthFormState } from "@/actions/auth";

function Field({ label, name, type = "text", placeholder, icon, error, required, autoComplete }: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  icon?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}{required ? <span className="text-danger"> *</span> : null}
      </span>
      <div className="relative">
        {icon && (
          <Icon name={icon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        )}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          autoComplete={autoComplete}
          aria-invalid={Boolean(error) || undefined}
          className={`h-10 w-full rounded-lg border bg-surface-2 ${error ? "border-danger/60" : "border-border"} ${icon ? "pl-9" : "pl-3"} pr-3 text-sm text-fg placeholder:text-fg-subtle focus-ring`}
        />
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-danger">
          <Icon name="AlertCircle" className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </label>
  );
}

function ForgotForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(forgotPasswordAction, null);
  const [submitted, setSubmitted] = useState(false);

  // Local copy of state to detect the success transition
  if (state?.ok && !submitted) {
    setSubmitted(true);
  }

  return (
    <motion.form
      action={action}
      className="space-y-4"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      noValidate
    >
      {submitted ? (
        <div className="space-y-3 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
            <Icon name="Mail" className="h-6 w-6" />
          </div>
          <p className="text-sm text-fg-muted">{state?.message}</p>
        </div>
      ) : (
        <>
          {state?.message && !state?.fieldErrors ? (
            <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
              <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{state.message}</span>
            </div>
          ) : null}
          <Field
            label="Email"
            name="email"
            type="email"
            placeholder="you@company.com"
            icon="Mail"
            required
            autoComplete="email"
            error={state?.fieldErrors?.email?.[0]}
          />
          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-ai text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pending && (
              <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
            )}
            {pending ? "Sending link…" : "Send reset link"}
          </button>
        </>
      )}

      <Link href="/login" className="block text-center text-xs text-fg-muted hover:text-brand">
        ← Back to sign in
      </Link>
    </motion.form>
  );
}

export default function ForgotPasswordPage() {
  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter the email on your account and we'll send you a reset link."
    >
      <ForgotForm />
    </AuthLayout>
  );
}
