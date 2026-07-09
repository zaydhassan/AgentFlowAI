"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { motion } from "framer-motion";
import { AuthLayout } from "@/components/auth/auth-layout";
import { Icon } from "@/components/ui/icon";
import { resetPasswordAction, type AuthFormState } from "@/actions/auth";

function Field({ label, name, type = "text", placeholder, icon, error, required, autoComplete, trailing }: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  icon?: string;
  error?: string;
  required?: boolean;
  autoComplete?: string;
  trailing?: React.ReactNode;
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
          className={`h-10 w-full rounded-lg border bg-surface-2 ${error ? "border-danger/60" : "border-border"} ${icon ? "pl-9" : "pl-3"} ${trailing ? "pr-9" : "pr-3"} text-sm text-fg placeholder:text-fg-subtle focus-ring`}
        />
        {trailing}
      </div>
      {error ? (
        <p className="mt-1.5 flex items-center gap-1.5 text-[11px] text-danger">
          <Icon name="AlertCircle" className="h-3 w-3" /> {error}
        </p>
      ) : null}
    </label>
  );
}

function ResetForm() {
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [state, action, pending] = useActionState<AuthFormState, FormData>(resetPasswordAction, null);
  const [showPassword, setShowPassword] = useState(false);

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-warning/10 text-warning">
          <Icon name="AlertCircle" className="h-6 w-6" />
        </div>
        <p className="text-sm text-fg-muted">
          This reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-r from-brand to-ai px-5 text-sm font-medium text-white"
        >
          Request a new link
        </Link>
      </div>
    );
  }

  return (
    <motion.form action={action} className="space-y-4" initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} noValidate>
      <input type="hidden" name="token" value={token} />
      {state?.message && !state?.fieldErrors ? (
        <div className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">
          <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.message}</span>
        </div>
      ) : null}
      <Field
        label="New password"
        name="password"
        type={showPassword ? "text" : "password"}
        placeholder="At least 12 characters"
        icon="Lock"
        required
        autoComplete="new-password"
        error={state?.fieldErrors?.password?.[0]}
        trailing={
          <button
            type="button"
            onClick={() => setShowPassword((s) => !s)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-fg-subtle hover:text-fg"
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            <Icon name={showPassword ? "EyeOff" : "Eye"} className="h-3.5 w-3.5" />
          </button>
        }
      />
      <Field
        label="Confirm new password"
        name="confirm"
        type={showPassword ? "text" : "password"}
        placeholder="Repeat your password"
        icon="Lock"
        required
        autoComplete="new-password"
        error={state?.fieldErrors?.confirm?.[0]}
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
        {pending ? "Saving…" : "Set new password"}
      </button>
      <Link href="/login" className="block text-center text-xs text-fg-muted hover:text-brand">
        ← Back to sign in
      </Link>
    </motion.form>
  );
}

export default function ResetPasswordPage() {
  return (
    <AuthLayout
      title="Set a new password"
      subtitle="Choose a strong password you don't reuse anywhere else."
    >
      <Suspense fallback={null}>
        <ResetForm />
      </Suspense>
    </AuthLayout>
  );
}
