import type { Metadata } from "next";
import Link from "next/link";
import { MarketingPage } from "@/components/marketing/page-shell";
import { BlurReveal } from "@/components/marketing/motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { templates } from "@/lib/mock/data";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Templates — AgentFlow AI",
  description:
    "Browse production-ready AI workflow templates — lead generation, invoice processing, support triage, and more. Preview the gallery before you build.",
};

// Public preview of the template gallery. The in-app marketplace
// (/marketplace) is the signed-in, premium install flow — this page keeps
// "Templates" in the navbar reachable for visitors, with every CTA routing
// into it (signed-out users hop through login and land back on /marketplace).
const CTA_HREF = "/marketplace";

export default function TemplatesPage() {
  const featured = templates.filter((t) => t.featured);
  const rest = templates.filter((t) => !t.featured);

  return (
    <MarketingPage>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[680px] max-w-full -translate-x-1/2 rounded-full opacity-40 blur-3xl"
          style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.25), transparent 70%)" }}
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-5 pb-14 pt-20 text-center lg:px-8">
          <Badge tone="ai" className="mx-auto mb-5">Templates</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Workflow templates that <span className="text-brand-gradient">ship in one click</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-fg-muted">
            {templates.length}+ production-ready workflows, built and tuned by the AgentFlow team.
            Preview the gallery here — sign in to install any template straight into your builder.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link href={CTA_HREF}>
              <Button variant="ai" size="lg" className="btn-shine">
                <Icon name="Store" className="h-4 w-4" /> Open the marketplace
              </Button>
            </Link>
            <Link href="/signup">
              <Button variant="ghost" size="lg">Start free</Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Featured templates ───────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-4 lg:px-8">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          <Icon name="Sparkles" className="h-3.5 w-3.5 text-brand" /> Featured
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          {featured.map((t) => (
            <TemplateCard key={t.id} template={t} featured />
          ))}
        </div>
      </section>

      {/* ── All templates ────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-10 lg:px-8">
        <div className="mt-10 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
          <Icon name="LayoutGrid" className="h-3.5 w-3.5 text-ai" /> All templates
        </div>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rest.map((t) => (
            <TemplateCard key={t.id} template={t} />
          ))}
        </div>
      </section>

      {/* ── CTA ──────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-5 pb-20 lg:px-8">
        <BlurReveal className="relative overflow-hidden rounded-3xl border border-border bg-surface/90 px-6 py-10 text-center sm:px-10">
          <div
            className="pointer-events-none absolute left-1/2 top-0 h-48 w-96 max-w-full -translate-x-1/2 rounded-full opacity-40 blur-3xl"
            style={{ background: "radial-gradient(50% 50% at 50% 50%, rgba(124,92,255,0.3), transparent 70%)" }}
            aria-hidden
          />
          <div className="relative">
            <h2 className="text-2xl font-semibold tracking-tight">Don&rsquo;t start from scratch</h2>
            <p className="mx-auto mt-3 max-w-lg text-fg-muted">
              Install a template, wire it to your stack, and let the agents do the rest.
              Every template is fully customizable in the visual builder.
            </p>
            <div className="mt-6 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link href={CTA_HREF}>
                <Button variant="ai" size="lg" className="btn-shine">
                  <Icon name="Download" className="h-4 w-4" /> Browse the marketplace
                </Button>
              </Link>
              <Link href="/contact">
                <Button variant="ghost" size="lg">Talk to us</Button>
              </Link>
            </div>
            <p className="mt-4 text-xs text-fg-subtle">
              Questions? Email {site.email} — we reply to every message.
            </p>
          </div>
        </BlurReveal>
      </section>
    </MarketingPage>
  );
}

/* ── Card — shared by featured + all-template grids ───────────────────── */

function TemplateCard({
  template: t,
  featured = false,
}: {
  template: (typeof templates)[number];
  featured?: boolean;
}) {
  return (
    <Link
      href={CTA_HREF}
      className="card-hover group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-surface-2/40 p-5 transition-colors duration-300 hover:border-border-strong hover:bg-surface-2/70 focus-ring"
    >
      {t.featured && featured && (
        <div
          className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-20 blur-2xl"
          style={{ background: t.color }}
        />
      )}
      <div className="flex items-start justify-between">
        <span
          className="grid h-11 w-11 place-items-center rounded-xl"
          style={{ background: `${t.color}22`, color: t.color }}
        >
          <Icon name={t.icon} className="h-5 w-5" />
        </span>
        {t.featured && <Badge tone="brand">Featured</Badge>}
      </div>
      <h3 className="mt-3.5 text-sm font-semibold text-fg">{t.name}</h3>
      <p className="mt-1 line-clamp-2 text-xs text-fg-muted">{t.description}</p>
      <div className="mt-3 flex items-center gap-3 text-[11px] text-fg-subtle">
        <span className="flex items-center gap-1">
          <Icon name="Download" className="h-3 w-3" /> {t.installs.toLocaleString("en-US")}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="Star" className="h-3 w-3 text-warning" /> {t.rating}
        </span>
        <span className="flex items-center gap-1">
          <Icon name="Workflow" className="h-3 w-3" /> {t.nodeCount}
        </span>
      </div>
      <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-brand transition-transform duration-300 group-hover:translate-x-0.5">
        Open in marketplace
        <Icon name="ArrowRight" className="h-3.5 w-3.5" />
      </span>
    </Link>
  );
}