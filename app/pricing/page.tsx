"use client";

import Link from "next/link";
import { useState } from "react";
import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const plans = [
  {
    name: "Free",
    price: { monthly: 0, yearly: 0 },
    period: "forever",
    tagline: "For exploring the platform",
    features: ["3 active workflows", "1,000 credits / month", "Community templates", "Email support", "1 workspace member"],
    cta: "Start free",
    featured: false,
  },
  {
    name: "Pro",
    price: { monthly: 29, yearly: 24 },
    period: "/ mo",
    tagline: "For makers & small teams",
    features: ["25 active workflows", "150,000 credits / month", "AI Copilot + self-healing", "Priority support", "3 workspace members", "Version history"],
    cta: "Start Pro",
    featured: true,
  },
  {
    name: "Business",
    price: { monthly: 99, yearly: 82 },
    period: "/ mo",
    tagline: "For scaling teams",
    features: ["Unlimited workflows", "1,000,000 credits / month", "RBAC + audit logs", "SSO ready", "10 workspace members", "Secrets manager", "Usage analytics"],
    cta: "Start Business",
    featured: false,
  },
  {
    name: "Enterprise",
    price: { monthly: null, yearly: null },
    period: "",
    tagline: "For large organizations",
    features: ["Self-hosted option", "Custom credit volume", "Dedicated support", "SLA + uptime guarantees", "Unlimited members", "Custom nodes & integrations", "Onboarding & training"],
    cta: "Contact sales",
    featured: false,
  },
];

const faqs = [
  { q: "What is a credit?", a: "Credits are the unified unit that powers AI inference, API calls, storage, and compute. Each action consumes a small, transparent number of credits." },
  { q: "Do unused credits roll over?", a: "On Pro and Business plans, up to 20% of unused monthly credits roll over to the next month, capped at one month's allotment." },
  { q: "Can I change plans anytime?", a: "Yes — upgrade, downgrade, or cancel at any time. Changes are prorated automatically through Stripe." },
  { q: "Is there a free trial of paid plans?", a: "Every account starts with 1,000 free credits. You can upgrade to a paid plan whenever you're ready, no card required to start." },
  { q: "How does self-hosting work on Enterprise?", a: "Enterprise customers can deploy AgentFlow inside their own VPC on AWS, Azure, or GCP with Kubernetes, keeping all data in-network." },
];

export default function PricingPage() {
  const [yearly, setYearly] = useState(true);
  return (
    <div className="min-h-screen">
      <MarketingNav />
      <section className="relative mesh-bg overflow-hidden pt-32 pb-20">
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Pricing</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Credit-based pricing that <span className="text-brand-gradient">scales with you</span></h1>
          <p className="mx-auto mt-5 max-w-xl text-fg-muted">Start free. Pay only for what you run. Upgrade when your automations outgrow the free tier.</p>

          <div className="mt-8 inline-flex items-center gap-1 rounded-xl border border-border bg-surface-2/60 p-1">
            <button onClick={() => setYearly(false)} className={cn("rounded-lg px-4 py-1.5 text-sm transition-colors", !yearly ? "bg-brand text-white" : "text-fg-muted hover:text-fg")}>Monthly</button>
            <button onClick={() => setYearly(true)} className={cn("rounded-lg px-4 py-1.5 text-sm transition-colors flex items-center gap-1.5", yearly ? "bg-brand text-white" : "text-fg-muted hover:text-fg")}>
              Yearly <Badge tone="success" className="bg-success/20 text-success">−17%</Badge>
            </button>
          </div>
        </div>

        <div className="relative mx-auto mt-12 max-w-7xl px-5 lg:px-8 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.map((p) => {
            const price = yearly ? p.price.yearly : p.price.monthly;
            return (
              <div key={p.name} className={cn("card-hover relative flex flex-col rounded-2xl border p-6", p.featured ? "border-brand/50 bg-brand-soft/20 shadow-[0_10px_50px_-12px_rgba(124,92,255,0.5)]" : "glass border-border")}>
                {p.featured && <div className="absolute -top-3 left-1/2 -translate-x-1/2"><Badge tone="brand">Most popular</Badge></div>}
                <div className="text-sm font-semibold text-fg-muted">{p.name}</div>
                <div className="text-[11px] text-fg-subtle">{p.tagline}</div>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="text-4xl font-semibold tracking-tight">{price === null ? "Custom" : `$${price}`}</span>
                  {price !== null && <span className="text-xs text-fg-subtle">{p.period}</span>}
                </div>
                {yearly && price !== null && price > 0 && <div className="text-[11px] text-success">billed annually</div>}
                <Link href="/signup" className="mt-5"><Button variant={p.featured ? "ai" : "secondary"} size="md" className="w-full">{p.cta}</Button></Link>
                <ul className="mt-6 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm text-fg-muted">
                      <Icon name="Check" className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" /> {f}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 lg:px-8 py-20">
        <h2 className="text-center text-2xl font-semibold tracking-tight">Frequently asked questions</h2>
        <div className="mt-8 space-y-3">
          {faqs.map((f) => (
            <details key={f.q} className="group rounded-xl border border-border bg-surface-2/40 p-4 [&_summary]:cursor-pointer">
              <summary className="flex items-center justify-between text-sm font-medium marker:content-none">
                {f.q}
                <Icon name="ChevronDown" className="h-4 w-4 text-fg-subtle transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm text-fg-muted">{f.a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 lg:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-border mesh-bg p-12 text-center">
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight">Ready to automate?</h2>
            <p className="mx-auto mt-3 max-w-md text-fg-muted">Start free with 1,000 credits. No card required.</p>
            <Link href="/signup" className="mt-6 inline-block"><Button size="lg" variant="ai"><Icon name="Rocket" className="h-4 w-4" /> Get started</Button></Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}