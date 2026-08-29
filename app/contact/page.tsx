import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { BlurReveal } from "@/components/marketing/motion";
import { StaggerContainer, StaggerItem } from "@/components/marketing/motion";
import { ContactForm } from "@/components/marketing/contact-form";
import { Button } from "@/components/ui/button";
import { ContactHero } from "@/components/contact/contact-hero";
import { ContactFaq } from "@/components/contact/contact-faq";
import { Icon } from "@/components/ui/icon";
import { SiteContainer } from "@/components/marketing/container";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact — AgentFlow AI",
  description: "Get in touch with the AgentFlow AI team. Business email, GitHub, LinkedIn, and a contact form.",
};

// Existing FAQ content — preserved verbatim.
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

const RESPONSES = [
  { icon: "CreditCard", title: "Sales & pricing", time: "within 1 business day", color: "#7c5cff" },
  { icon: "LifeBuoy", title: "Support", time: "within 2 business days", color: "#22d3ee" },
  { icon: "ShieldCheck", title: "Security disclosures", time: "within 24 hours", color: "#34d399" },
] as const;

export default function ContactPage() {
  return (
    <MarketingPage>
      <ContactHero />

      {/* ── Main area — channels/response | form (≈35% / 65%) ────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute right-0 top-0 h-[420px] w-[560px] max-w-full rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.1), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-6xl px-5 py-20 lg:px-8">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,35fr)_minmax(0,65fr)]">
            {/* ── LEFT — channels + response expectations ─────────── */}
            <div className="space-y-6">
              <StaggerContainer stagger={0.1}>
                <StaggerItem y={10}>
                  <h2 className="text-[11px] font-semibold uppercase tracking-widest text-fg-subtle">
                    Channels
                  </h2>
                  <ul className="mt-4 space-y-3">
                    <ChannelRow
                      href={`mailto:${site.email}`}
                      label="Email"
                      desc={site.email}
                      tile={{ className: "bg-brand-soft text-brand", icon: "Mail" }}
                    />
                    <ChannelRow
                      href={site.socials.github}
                      external
                      label="GitHub"
                      desc="Bugs, feature requests, & source"
                      tile={{ className: "bg-surface-3 text-fg", icon: "GitBranch" }}
                    />
                    {/* No href yet — rendered static so it can't lead to a
                        wrong profile. Re-add href/external once the page exists. */}
                    <ChannelRow
                      label="LinkedIn"
                      desc="Company updates & careers"
                      tile={{ className: "bg-ai/10 text-ai", icon: "in" }}
                    />
                  </ul>
                </StaggerItem>
              </StaggerContainer>

              {/* Response expectations — product-status style panel. */}
              <StaggerContainer stagger={0.08}>
                <StaggerItem>
                  <div className="rounded-2xl border border-border bg-surface-2/40 p-5">
                    <h3 className="text-sm font-semibold">Response expectations</h3>
                    <ul className="mt-4 space-y-3">
                      {RESPONSES.map((r) => (
                        <ResponseRow key={r.title} icon={r.icon} title={r.title} time={r.time} color={r.color} />
                      ))}
                    </ul>
                  </div>
                </StaggerItem>
              </StaggerContainer>
            </div>

            {/* ── RIGHT — the form (visual centerpiece) ───────────── */}
            <StaggerContainer stagger={0.1}>
              <StaggerItem>
                <div
                  id="contact-form"
                  className="surface-premium relative scroll-mt-24 overflow-hidden rounded-2xl border border-border p-6 sm:p-8"
                >
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 h-px"
                    style={{
                      background:
                        "linear-gradient(90deg, transparent, rgba(124,92,255,0.6), rgba(34,211,238,0.6), transparent)",
                    }}
                    aria-hidden
                  />
                  <div
                    className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full opacity-50 blur-3xl"
                    style={{
                      background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.22), transparent 70%)",
                    }}
                    aria-hidden
                  />
                  <div className="relative">
                    <h2 className="text-lg font-semibold">Send us a message</h2>
                    <p className="mt-1 text-sm text-fg-muted">
                      The quickest way to reach a human. We reply to every message.
                    </p>
                    <div className="mt-6">
                      <ContactForm />
                    </div>
                  </div>
                </div>
              </StaggerItem>
            </StaggerContainer>
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pb-16 lg:px-8">
        <h2 className="flex items-center justify-center gap-2.5 text-center text-2xl font-semibold tracking-tight">
          <Icon name="MessageCircleQuestion" className="h-5 w-5 shrink-0 text-brand" />
          Frequently asked questions
        </h2>
        <ContactFaq faqs={faqs} />
      </section>

      {/* ── Final CTA ───────────────────────────────────────────────── */}
      {/* Same shared container as the footer below, so their left/right
          edges sit on one vertical grid at every viewport width. */}
      <section className="pb-16 md:pb-20 lg:pb-24">
        <SiteContainer>
        <div className="mx-auto w-full max-w-4xl rounded-3xl bg-gradient-to-br from-brand/40 via-border to-ai/40 p-px">
          <BlurReveal className="relative overflow-hidden rounded-[calc(1.5rem-1px)] bg-surface/90 px-6 py-6 sm:px-8 lg:px-10 lg:py-8">
            {/* Side glows */}
            <div
              className="pointer-events-none absolute -left-20 top-0 h-full w-72 rounded-full opacity-50 blur-3xl"
              style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.3), transparent 70%)" }}
              aria-hidden
            />
            <div
              className="pointer-events-none absolute -right-20 top-0 h-full w-72 rounded-full opacity-40 blur-3xl"
              style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(34,211,238,0.24), transparent 70%)" }}
              aria-hidden
            />
            <div className="relative flex flex-col items-center gap-5 text-center lg:flex-row lg:items-center lg:justify-between lg:gap-8 lg:text-left">
              {/* Glowing paper-plane surrounded by orbital lines + particles */}
              <div className="relative h-28 w-28 shrink-0" aria-hidden>
                <div className="absolute inset-0 rounded-full border border-dashed border-border/50" />
                <div className="orbital-ring absolute inset-2" style={{ animationDuration: "90s" }} />
                <div
                  className="orbital-ring absolute inset-[22%]"
                  style={{ animationDirection: "reverse", animationDuration: "60s" }}
                />
                <div
                  className="absolute inset-[20%] rounded-full opacity-70 blur-xl"
                  style={{ background: "radial-gradient(circle, rgba(124,92,255,0.35), transparent 70%)" }}
                />
                <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <span className="grid h-11 w-11 place-items-center rounded-2xl border border-brand/40 bg-brand-soft text-brand shadow-[0_0_24px_-4px_rgba(124,92,255,0.7)]">
                    <Icon name="Send" className="h-5 w-5" />
                  </span>
                </span>
                <span className="dot dot-live absolute left-[14%] top-[32%] h-1 w-1 rounded-full bg-ai" />
                <span
                  className="dot dot-live absolute bottom-[24%] right-[16%] h-1 w-1 rounded-full bg-brand"
                  style={{ animationDelay: "1.4s" }}
                />
              </div>

              <div className="min-w-0 lg:max-w-sm">
                <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
                  Still have a question?
                </h2>
                <p className="mt-3 text-fg-muted">We&rsquo;re here to help. Drop us a message.</p>
                <div className="mt-6 flex justify-center lg:justify-start">
                  <Link href="#contact-form">
                    <Button variant="ai" size="lg" className="btn-shine">
                      <Icon name="Send" className="h-4 w-4" /> Send us a message
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </BlurReveal>
          </div>
        </SiteContainer>
      </section>
    </MarketingPage>
  );
}

/* ── Channel row — interactive link row ────────────────────────────────── */

function ChannelRow({
  href,
  external,
  label,
  desc,
  tile,
}: {
  // Omit to render the row as static (non-clickable) — used for channels
  // like LinkedIn that have no live URL yet.
  href?: string;
  external?: boolean;
  label: string;
  desc: string;
  tile: { className: string; icon: string };
}) {
  const body = (
    <>
      <span
        className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg transition-shadow duration-300 group-hover:shadow-[0_0_18px_-2px_rgba(124,92,255,0.6)] ${tile.className}`}
      >
        {tile.icon === "in" ? (
          <span className="text-xs font-semibold leading-none">in</span>
        ) : (
          <Icon name={tile.icon} className="h-4 w-4" />
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block truncate text-xs text-fg-muted">{desc}</span>
      </span>
      <Icon
        name="ArrowUpRight"
        className="h-4 w-4 shrink-0 text-fg-subtle transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-brand"
      />
    </>
  );

  return (
    <li className="group">
      {href ? (
        <a
          href={href}
          {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="flex items-center gap-3.5 rounded-xl border border-border bg-surface-2/40 p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-2/70 focus-ring"
        >
          {body}
        </a>
      ) : (
        <div
          aria-disabled="true"
          title="LinkedIn — link coming soon"
          className="flex cursor-default items-center gap-3.5 rounded-xl border border-border bg-surface-2/40 p-4 opacity-70"
        >
          {body}
        </div>
      )}
    </li>
  );
}

/* ── Response expectation row ──────────────────────────────────────────── */

function ResponseRow({
  icon,
  title,
  time,
  color,
}: {
  icon: string;
  title: string;
  time: string;
  color: string;
}) {
  return (
    <li className="flex items-center gap-3">
      <span
        className="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
        style={{ background: `${color}1a`, color, boxShadow: `inset 0 0 0 1px ${color}33` }}
      >
        <Icon name={icon} className="h-4 w-4" />
      </span>
      <span className="text-sm">{title}</span>
      <span className="ml-auto flex items-center gap-2 text-xs text-fg-subtle">
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px 1px ${color}66` }} aria-hidden />
        {time}
      </span>
    </li>
  );
}