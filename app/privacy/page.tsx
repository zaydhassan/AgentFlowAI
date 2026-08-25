import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — AgentFlow AI",
  description: "How AgentFlow AI collects, uses, and protects your data.",
};

const sections = [
  {
    h: "Data we collect",
    body: [
      "Account data: name, email, and workspace membership you provide when signing up.",
      "Usage data: workflow configurations, execution logs, and node inputs/outputs you create while using the platform.",
      "Billing data: handled by our payment processor (Stripe). We never store full card numbers on our servers.",
      "Technical data: IP address, browser type, and product analytics (event-level, pseudonymized) to improve reliability.",
    ],
  },
  {
    h: "How we use your data",
    body: [
      "To operate the platform: run your workflows, persist state, and show execution history.",
      "To provide support: investigate issues you report and respond to your messages.",
      "To improve the product: aggregate, pseudonymized analytics on feature usage and error rates.",
      "We never sell your data, and we never train models on your private workflow content.",
    ],
  },
  {
    h: "AI processing",
    body: [
      "Workflows may invoke AI models to process data you provide. We route requests through vetted model providers and apply data-handling terms appropriate to your plan.",
      "By default, inputs and outputs of your runs are retained so you can inspect, replay, and audit them. You can configure retention per workspace or purge history on demand.",
    ],
  },
  {
    h: "Data retention & deletion",
    body: [
      "Execution history is retained according to your plan's retention window and can be shortened in workspace settings.",
      "You can delete your account at any time from settings. Deletion removes your workspaces, workflows, and associated data within 30 days, except where retention is legally required.",
    ],
  },
  {
    h: "Sharing & subprocessors",
    body: [
      "We share data only with subprocessors needed to run the service (e.g. hosting, email, payments) under data-processing agreements.",
      "We do not share your data with third parties for marketing purposes.",
    ],
  },
  {
    h: "Security",
    body: [
      "Data is encrypted in transit (TLS) and at rest. Access is least-privilege and logged. See our Security page for the full program.",
    ],
  },
  {
    h: "Your rights",
    body: [
      `Depending on your jurisdiction, you may have rights to access, correct, export, or delete your personal data. Email ${site.legal.privacy} to exercise these rights.`,
    ],
  },
  {
    h: "Changes to this policy",
    body: [
      "We'll update this page when the policy changes. For material changes we'll notify you in-product and by email at least 30 days in advance.",
    ],
  },
];

export default function PrivacyPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-5 lg:px-8 py-20 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Legal</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Privacy Policy</h1>
          <p className="mt-4 text-sm text-fg-subtle">Last updated: July 9, 2026</p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 lg:px-8 pb-24">
        <p className="text-fg-muted">
          AgentFlow AI (&ldquo;we&rdquo;, &ldquo;us&rdquo;) builds automation tooling. This policy
          explains what data we collect, why we collect it, and the controls you have over it.
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
          Questions about this policy? Email{" "}
          <a href={`mailto:${site.legal.privacy}`} className="text-brand hover:underline">{site.legal.privacy}</a>{" "}
          or use our <a href="/contact" className="text-brand hover:underline">contact page</a>.
        </div>
      </section>
    </MarketingPage>
  );
}