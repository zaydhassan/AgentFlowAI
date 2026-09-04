import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { SecurityHero } from "@/components/marketing/security/security-hero";
import { SecurityTrustRow } from "@/components/marketing/security/security-trust-row";
import { SecurityCapabilityCard } from "@/components/marketing/security/security-capability-card";
import { SecurityPractices } from "@/components/marketing/security/security-practices";
import { SecurityCta } from "@/components/marketing/security/security-cta";
import { site } from "@/lib/site";

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
      {/* One consistent page background: near-black base, faded grid, purple/cyan glows. */}
      <div className="relative isolate">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(40% 28% at 2% 8%, rgba(124,92,255,0.09), transparent 70%), radial-gradient(36% 26% at 98% 14%, rgba(34,211,238,0.07), transparent 70%), radial-gradient(32% 22% at 50% 100%, rgba(91,139,255,0.05), transparent 70%)",
            }}
          />
          <div className="grid-overlay absolute inset-0 opacity-70 [mask-image:linear-gradient(to_bottom,transparent,#000_6%,#000_88%,transparent)]" />
        </div>

        <SecurityHero description="Your workflows touch real systems and real data. We engineer AgentFlow to be worthy of that trust — defense in depth, transparent practices, and the controls your security team expects." />

        <SecurityTrustRow />

        {/* Security capabilities — 3-column desktop grid. */}
        <section aria-label="Security capabilities" className="relative mx-auto max-w-7xl px-5 py-20 lg:px-8">
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {pillars.map((p, i) => (
              <SecurityCapabilityCard key={p.title} capability={p} index={i} />
            ))}
          </div>
        </section>

        {/* Practices + responsible disclosure — two-column. */}
        <section aria-label="Security practices" className="relative border-t border-border bg-bg-soft/40">
          <div className="mx-auto max-w-5xl px-5 py-20 lg:px-8">
            <SecurityPractices
              practices={practices}
              disclosure="We reward responsible disclosure. Email us with a reproducible report — we respond within 24 hours, validate, and credit you (or keep you anonymous) on fix."
              note="Please don't test on production accounts or customer data. Provide a PoC in your report."
              email={site.legal.security}
            />
          </div>
        </section>

        {/* Bottom CTA. */}
        <section aria-label="Get started" className="relative mx-auto max-w-7xl px-5 pb-24 pt-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <SecurityCta enterprise="Enterprise customers get a completed security questionnaire, SOC 2 report access, and a named solutions contact." />
          </div>
        </section>
      </div>
    </MarketingPage>
  );
}