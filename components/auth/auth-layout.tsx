"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left — form */}
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-16">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai">
            <Icon name="Workflow" className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold">AgentFlow<span className="text-brand"> AI</span></span>
        </Link>

        <div className="flex flex-1 items-center">
          <div className="w-full max-w-sm mx-auto">
            <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
            <p className="mt-1.5 text-sm text-fg-muted">{subtitle}</p>
            <div className="mt-7">{children}</div>
            {footer && <div className="mt-6 text-center text-sm text-fg-muted">{footer}</div>}
          </div>
        </div>
        <div className="text-xs text-fg-subtle">© {new Date().getFullYear()} AgentFlow AI</div>
      </div>

      {/* Right — showcase */}
      <div className="relative hidden lg:block mesh-bg overflow-hidden border-l border-border">
        <div className="grid-overlay absolute inset-0" />
        <div className="relative flex h-full flex-col justify-center px-16">
          <div className="max-w-md">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-3 py-1 text-xs text-fg-muted">
              <span className="dot dot-live bg-success" /> 12 agents running across 47 workflows
            </div>
            <h2 className="mt-6 text-3xl font-semibold tracking-tight">
              The automation platform where <span className="text-brand-gradient">AI is the engine</span>.
            </h2>
            <p className="mt-4 text-fg-muted">
              Reason over every step. Recover from failures automatically. Let a copilot optimize cost and
              architecture. Build in minutes, scale to thousands of enterprise customers.
            </p>
            <div className="mt-8 space-y-3">
              {[
                { icon: "Sparkles", t: "Natural-language workflow builder" },
                { icon: "Wrench", t: "Self-healing executions" },
                { icon: "LineChart", t: "Full AI observability" },
                { icon: "ShieldCheck", t: "RBAC, audit logs, SSO ready" },
              ].map((f) => (
                <div key={f.t} className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 px-4 py-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand">
                    <Icon name={f.icon} className="h-4 w-4" />
                  </span>
                  <span className="text-sm">{f.t}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OAuthButtons() {
  return (
    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
      <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3 transition-colors">
        <Icon name="Chrome" className="h-4 w-4" /> Google
      </button>
      <button className="flex h-10 items-center justify-center gap-2 rounded-lg border border-border bg-surface-2 text-sm font-medium hover:bg-surface-3 transition-colors">
        <Icon name="Github" className="h-4 w-4" /> GitHub
      </button>
    </div>
  );
}

export function Field({
  label,
  type = "text",
  placeholder,
  icon,
}: {
  label: string;
  type?: string;
  placeholder?: string;
  icon?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      <div className="relative">
        {icon && (
          <Icon name={icon} className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
        )}
        <input
          type={type}
          placeholder={placeholder}
          className={`h-10 w-full rounded-lg border border-border bg-surface-2 ${icon ? "pl-9" : "pl-3"} pr-3 text-sm text-fg placeholder:text-fg-subtle focus-ring`}
        />
      </div>
    </label>
  );
}