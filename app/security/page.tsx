import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";

export const metadata: Metadata = {
  title: "Security — AgentFlow AI",
  description: "How AgentFlow AI keeps your data and automations secure.",
};

const pillars = [
  { icon: "Lock", title: "Encryption", body: "TLS 1.2+ in transit, AES-256 at rest. Secrets stored encrypted with a managed KMS and never logged in plaintext." },
  { icon: "ShieldCheck", title: "Access control", body: "Least-privilege internal access, MFA enforced on staff, and just-in-time elevation scoped per incident." },
  { icon: "Eye", title: "Auditability", body: "Every workflow run and admin action is logged with an immutable audit trail, exportable on Business & Enterprise." },
  { icon: "KeyRound", title: "Secrets management", body: "Per-workspace secret vault. Integrations use scoped tokens you control — we never retain more than needed." },
  { icon: "Server", title: "Isolation", body: "Workflows execute in isolated, ephemeral runtimes with resource limits. One tenant's run can't reach another's data." },
  { icon: "FileCheck2", title: "Compliance", body: "SOC 2 Type II in progress, GDPR-aligned data handling, and self-hosted VPC deployment available on Enterprise." },
];

const practices = [
  "Continuous dependency scanning and SAST on every change",
  "Quarterly third-party penetration testing with remediation tracking",
  "Coordinated vulnerability disclosure with a 90-day disclosure window",
  "Incident response runbook with named on-call rotation",
  "Data residency options for Enterprise customers",
];

export default function SecurityPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8 py-24 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Security</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Security is a <span className="text-brand-gradient">prerequisite</span>, not a feature
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-lg text-fg-muted">
            Your workflows touch real systems and real data. We engineer AgentFlow to be worthy of
            that trust — defense in depth, transparent practices, and the controls your security
            team expects.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 lg:px-8 py-20">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {pillars.map((p) => (
            <div key={p.title} className="card-hover rounded-2xl border border-border bg-surface-2/40 p-6">
              <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand">
                <Icon name={p.icon} className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-base font-semibold">{p.title}</h3>
              <p className="mt-1.5 text-sm text-fg-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border bg-bg-soft/40">
        <div className="mx-auto max-w-5xl px-5 lg:px-8 py-16 grid gap-10 md:grid-cols-2">
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">Security practices</h2>
            <ul className="mt-6 space-y-3">
              {practices.map((p) => (
                <li key={p} className="flex items-start gap-2.5 text-sm text-fg-muted">
                  <Icon name="CheckCircle2" className="mt-0.5 h-4 w-4 shrink-0 text-success" /> {p}
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-bg p-6">
            <div className="inline-flex items-center gap-2 text-ai">
              <Icon name="Bug" className="h-4 w-4" />
              <span className="text-xs font-semibold uppercase tracking-widest">Responsible disclosure</span>
            </div>
            <h3 className="mt-3 text-lg font-semibold">Found a vulnerability?</h3>
            <p className="mt-2 text-sm text-fg-muted">
              We reward responsible disclosure. Email us with a reproducible report — we respond
              within 24 hours, validate, and credit you (or keep you anonymous) on fix.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link href="mailto:security@agentflow.ai"><Button variant="secondary" size="md">security@agentflow.ai</Button></Link>
            </div>
            <p className="mt-3 text-xs text-fg-subtle">
              Please don&apos;t test on production accounts or customer data. Provide a PoC in your report.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 lg:px-8 py-16">
        <div className="rounded-3xl border border-border mesh-bg p-10 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Need a security review?</h2>
          <p className="mx-auto mt-3 max-w-md text-fg-muted">
            Enterprise customers get a completed security questionnaire, SOC 2 report access, and a
            named solutions contact.
          </p>
          <Link href="/contact" className="mt-6 inline-block"><Button size="lg" variant="ai"><Icon name="Shield" className="h-4 w-4" /> Request a review</Button></Link>
        </div>
      </section>
    </MarketingPage>
  );
}