"use client";

import { useActionState } from "react";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { submitContact, type ContactState } from "@/actions/contact";

export function ContactForm() {
  const [state, action, pending] = useActionState<ContactState, FormData>(submitContact, null);

  if (state?.ok) {
    return (
      <div
        className="rounded-2xl border border-success/30 bg-success/5 p-8 text-center"
        role="status"
      >
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-success/10 text-success">
          <Icon name="CheckCircle2" className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">Message sent</h3>
        <p className="mx-auto mt-2 max-w-sm text-sm text-fg-muted">
          Thanks for reaching out — we&apos;ll get back to you within one business day. We&apos;ve
          routed your message to the right team.
        </p>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4" noValidate>
      {state?.error && (
        <div
          className="flex items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 p-3 text-sm text-danger"
          role="alert"
        >
          <Icon name="AlertTriangle" className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field
          label="Name"
          name="name"
          placeholder="Ada Lovelace"
          icon="User"
          autoComplete="name"
          required
        />
        <Field
          label="Email"
          name="email"
          type="email"
          placeholder="you@company.com"
          icon="Mail"
          autoComplete="email"
          required
        />
      </div>

      <Field
        label="Company"
        name="company"
        placeholder="Acme Inc. (optional)"
        icon="Building2"
        autoComplete="organization"
      />

      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-fg-muted">
          Message<span className="text-danger"> *</span>
        </span>
        <textarea
          name="message"
          rows={6}
          required
          minLength={10}
          placeholder="Tell us what you're trying to automate…"
          aria-describedby="message-hint"
          className="w-full rounded-xl border border-border bg-surface-2/70 px-3.5 py-2.5 text-sm text-fg transition-colors placeholder:text-fg-subtle hover:border-border-strong focus-ring focus:border-brand/50"
        />
        <p id="message-hint" className="mt-1.5 text-[11px] text-fg-subtle">
          Minimum 10 characters. The more context, the better we can help.
        </p>
      </label>

      <Button
        type="submit"
        variant="ai"
        size="lg"
        className="btn-shine group w-full"
        disabled={pending}
        aria-busy={pending}
      >
        {pending ? (
          <span
            className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white"
            aria-hidden
          />
        ) : (
          <Icon
            name="Send"
            className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
          />
        )}
        {pending ? "Sending…" : "Send message"}
      </Button>
    </form>
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
};

function Field({ label, name, type = "text", placeholder, icon, autoComplete, required }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">
        {label}
        {required ? <span className="text-danger"> *</span> : null}
      </span>
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
          aria-label={label}
          className={`h-10 w-full rounded-xl border border-border bg-surface-2/70 text-sm text-fg transition-colors placeholder:text-fg-subtle hover:border-border-strong focus-ring focus:border-brand/50 ${icon ? "pl-9" : "pl-3.5"} pr-3`}
        />
      </div>
    </label>
  );
}