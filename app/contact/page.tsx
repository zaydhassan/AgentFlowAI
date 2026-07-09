import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { ContactForm } from "@/components/marketing/contact-form";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — AgentFlow AI",
  description: "Get in touch with the AgentFlow AI team. Business email, GitHub, LinkedIn, and a contact form.",
};

const faqs = [
  {
    q: "I want to evaluate AgentFlow for my team. What's the fastest path?",
    a: "Start on the Free plan — it includes 1,000 credits and full access to the workflow builder. For a guided evaluation or security review, use the form and mention your team size.",
  },
  {
    q: "Do you offer self-hosting or a data-residency option?",
    a: "Yes — self-hosted deployment inside your own VPC is available on Enterprise. Tell us about your compliance needs in the message and we'll connect you with a solutions engineer.",
  },
  {
    q: "How do I report a bug or request a feature?",
    a: "The fastest channel is GitHub — open an issue on our repository. For anything sensitive, email us directly instead of filing a public issue.",
  },
  {
    q: "I'm a partner or integrator. Who do I talk to?",
    a: "Use the contact form and select partnership as your topic (add it to your message). We actively work with tool vendors and system integrators.",
  },
];

export default function ContactPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-4xl px-5 lg:px-8 py-24 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Contact</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Let&apos;s talk
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted">
            Questions about the product, pricing, security, or partnerships? Pick the channel that
            fits — we read everything.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-5 lg:px-8 py-16 grid gap-10 lg:grid-cols-5">
        {/* Channels */}
        <div className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="text-sm font-semibold uppercase tracking-widest text-fg-subtle">Channels</h2>
            <ul className="mt-4 space-y-3">
              <li>
                <Link
                  href={`mailto:${site.email}`}
                  className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-4"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-soft text-brand text-base">@</span>
                  <span>
                    <span className="block text-sm font-medium">Email</span>
                    <span className="block text-xs text-fg-muted">{site.email}</span>
                  </span>
                </Link>
              </li>
              <li>
                <a
                  href={site.socials.github}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-4"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-3 text-fg text-base">⌥</span>
                  <span>
                    <span className="block text-sm font-medium">GitHub</span>
                    <span className="block text-xs text-fg-muted">Bugs, feature requests, &amp; source</span>
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={site.socials.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card-hover flex items-center gap-3 rounded-xl border border-border bg-surface-2/40 p-4"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-ai/10 text-ai text-base">in</span>
                  <span>
                    <span className="block text-sm font-medium">LinkedIn</span>
                    <span className="block text-xs text-fg-muted">Company updates &amp; careers</span>
                  </span>
                </a>
              </li>
            </ul>
          </div>

          <div className="rounded-2xl border border-border bg-bg-soft/40 p-5">
            <h3 className="text-sm font-semibold">Response expectations</h3>
            <ul className="mt-3 space-y-2 text-sm text-fg-muted">
              <li className="flex items-center gap-2"><span className="dot bg-success" /> Sales &amp; pricing — within 1 business day</li>
              <li className="flex items-center gap-2"><span className="dot bg-brand" /> Support — within 2 business days</li>
              <li className="flex items-center gap-2"><span className="dot bg-ai" /> Security disclosures — within 24 hours</li>
            </ul>
          </div>
        </div>

        {/* Form */}
        <div className="lg:col-span-3">
          <div className="rounded-2xl border border-border bg-surface-2/30 p-6 sm:p-8">
            <h2 className="text-lg font-semibold">Send us a message</h2>
            <p className="mt-1 text-sm text-fg-muted">
              The quickest way to reach a human. We reply to every message.
            </p>
            <div className="mt-6">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="mx-auto max-w-3xl px-5 lg:px-8 pb-24">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-surface-2/40 p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-sm font-medium marker:content-none">
                {f.q}
                <span className="ml-2 inline-block text-fg-subtle transition-transform group-open:rotate-45">+</span>
              </summary>
              <p className="mt-3 text-sm text-fg-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>
    </MarketingPage>
  );
}