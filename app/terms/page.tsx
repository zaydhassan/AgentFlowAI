import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = {
  title: "Terms of Service — AgentFlow AI",
  description: "The terms governing your use of AgentFlow AI.",
};

const sections = [
  {
    h: "Acceptance of terms",
    body: [
      "By creating an account or using AgentFlow AI, you agree to these terms. If you're using the service on behalf of a company, you represent that you have authority to bind that company.",
    ],
  },
  {
    h: "Your account & responsibilities",
    body: [
      "You're responsible for keeping your credentials secure and for all activity under your account.",
      "You agree to use the service lawfully and not to abuse it — including running workflows that violate others' rights, exceed reasonable use, or attempt to disrupt the platform.",
    ],
  },
  {
    h: "Acceptable use",
    body: [
      "Don't reverse-engineer, resell, or build a competing service on top of AgentFlow without permission.",
      "Workflows you build are yours. You're responsible for the data you process and the actions your automations take against third-party systems.",
    ],
  },
  {
    h: "Credits & billing",
    body: [
      "Paid plans are billed in advance and measured in credits, the unified unit for AI inference, API calls, storage, and compute.",
      "You can upgrade, downgrade, or cancel at any time; changes are prorated via Stripe. Refunds for unused credits are handled case by case — contact us.",
      "Free-tier usage is provided at our discretion and may change as the platform evolves.",
    ],
  },
  {
    h: "Intellectual property",
    body: [
      "We retain rights to the AgentFlow software, brand, and platform. You retain all rights to the workflows you create and the data you process.",
      "Templates you publish to the marketplace are licensed to other users under the terms shown at publication.",
    ],
  },
  {
    h: "Service availability",
    body: [
      "We target high availability but don't guarantee uninterrupted service. Scheduled maintenance is announced in advance.",
      "Enterprise plans include an SLA; see your agreement for specifics. No SLA applies to Free or self-serve plans beyond best-effort reliability.",
    ],
  },
  {
    h: "Termination",
    body: [
      "You can stop using the service and delete your account at any time. We may suspend or terminate access for non-payment, abuse, or legal compliance, with notice where reasonable.",
    ],
  },
  {
    h: "Disclaimers & liability",
    body: [
      "The service is provided &ldquo;as is&rdquo;. To the extent permitted by law, we disclaim warranties of merchantability or fitness for a particular purpose.",
      "Our liability for damages arising from the service is limited to the fees you paid in the preceding 12 months, except where law requires otherwise.",
    ],
  },
  {
    h: "Changes to these terms",
    body: [
      "We may update these terms. Material changes are announced in-product and by email at least 30 days before they take effect. Continued use after that window constitutes acceptance.",
    ],
  },
];

export default function TermsPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-5 lg:px-8 py-20 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Legal</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Terms of Service</h1>
          <p className="mt-4 text-sm text-fg-subtle">Last updated: July 9, 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 lg:px-8 pb-24">
        <p className="text-fg-muted">
          These terms govern your use of AgentFlow AI. They're written in plain language wherever
          possible, but they are a legal agreement — please read them.
        </p>
        <div className="mt-10 space-y-10">
          {sections.map((s, i) => (
            <div key={s.h}>
              <h2 className="flex items-center gap-2 text-xl font-semibold tracking-tight">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-brand-soft text-xs font-semibold text-brand">{i + 1}</span>
                {s.h}
              </h2>
              <ul className="mt-4 space-y-2.5 text-fg-muted">
                {s.body.map((p) => (
                  <li key={p} className="flex items-start gap-2.5 text-sm">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-brand/60" aria-hidden />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 rounded-2xl border border-border bg-surface-2/40 p-6 text-sm text-fg-muted">
          Questions about these terms? Email{" "}
          <a href="mailto:legal@agentflow.ai" className="text-brand hover:underline">legal@agentflow.ai</a>{" "}
          or use our <a href="/contact" className="text-brand hover:underline">contact page</a>.
        </div>
      </section>
    </MarketingPage>
  );
}