"use client";

import { Icon } from "@/components/ui/icon";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { useActionState, useState } from "react";
import { signupAction, type AuthFormState } from "@/actions/auth";
import { motion } from "framer-motion";

export function SignupFormSection({ providers }: { providers: { google: boolean; github: boolean } }) {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signupAction, null);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <>
      <OAuthButtons callbackUrl="/verify-email?pending=1" providers={providers} />
      <div className="my-5 flex items-center gap-3 text-[11px] text-fg-subtle">
        <div className="h-px flex-1 bg-border" /> OR SIGN UP WITH EMAIL <div className="h-px flex-1 bg-border" />
      </div>

      <form action={action} className="space-y-4" noValidate>
        {state?.message && !state?.fieldErrors ? (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
            role="alert"
          >
            <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{state.message}</span>
          </motion.div>
        ) : null}

        <Field
          label="Full name"
          name="name"
          placeholder="Maya Chen"
          icon="User"
          autoComplete="name"
          required
          error={state?.fieldErrors?.name?.[0]}
        />
        <Field
          label="Work email"
          name="email"
          type="email"
          placeholder="you@company.com"
          icon="Mail"
          autoComplete="email"
          required
          error={state?.fieldErrors?.email?.[0]}
        />
        <Field
          label="Workspace name"
          name="workspace"
          placeholder="Acme Robotics"
          icon="Building2"
          autoComplete="organization"
          error={state?.fieldErrors?.workspace?.[0]}
        />
        <div>
          <Field
            label="Password"
            name="password"
            type={showPassword ? "text" : "password"}
            placeholder="At least 12 characters"
            icon="Lock"
            autoComplete="new-password"
            required
            error={state?.fieldErrors?.password?.[0]}
            hint="12+ characters with letters and numbers"
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
        </div>

        <button
          type="submit"
          disabled={pending}
          aria-busy={pending}
          className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-brand to-ai text-sm font-medium text-white shadow-[0_8px_24px_-8px_rgba(34,211,238,0.6)] transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending && (
            <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
          )}
          {pending ? "Creating workspace…" : "Create workspace"}
        </button>

        <p className="flex items-start gap-2 text-[11px] text-fg-subtle">
          <Icon name="ShieldCheck" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
          By continuing you agree to our Terms and acknowledge our Privacy Policy. Your data is workspace-isolated.
        </p>
      </form>
    </>
  );
}

type FieldProps = {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  icon?: string;
  autoComplete?: string;
  required?: boolean;
  error?: string;
  hint?: string;
  trailing?: React.ReactNode;
};

function Field({ label, name, type = "text", placeholder, icon, autoComplete, required, error, hint, trailing }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}{required ? <span className="text-danger"> *</span> : null}</span>
      <div className="relative">
        {icon && (
          <Icon name={icon} className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        )}
        <input
          name={name}
          type={type}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={error ? `${name}-err` : hint ? `${name}-hint` : undefined}
          className={`h-10 w-full rounded-lg border bg-surface-2 ${error ? "border-danger/60" : "border-border"} ${icon ? "pl-9" : "pl-3"} ${trailing ? "pr-9" : "pr-3"} text-sm text-fg placeholder:text-fg-subtle focus-ring`}
        />
        {trailing}
      </div>
      {error ? (
        <p id={`${name}-err`} className="mt-1.5 flex items-center gap-1.5 text-[11px] text-danger">
          <Icon name="AlertCircle" className="h-3 w-3" /> {error}
        </p>
      ) : hint ? (
        <p id={`${name}-hint`} className="mt-1.5 text-[11px] text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </label>
  );
}
