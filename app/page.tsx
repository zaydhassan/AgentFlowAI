import Link from "next/link";
import { FadeIn, HeroFade, BlurReveal } from "@/components/marketing/motion";
import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { HeroBackground } from "@/components/marketing/hero-background";
import { HeroWorkflow } from "@/components/marketing/hero-workflow";
import { TrustLogos } from "@/components/marketing/trust-logos";
import { Metrics } from "@/components/marketing/metrics";
import { FeatureCards } from "@/components/marketing/feature-cards";
import { LivePreview } from "@/components/marketing/live-preview";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { NODE_LIBRARY, CATEGORY_META } from "@/lib/nodes";
import { PLAN_META } from "@/lib/payments/plan-meta";
import { auth } from "@/auth";

const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["3 active workflows", "1,000 credits / mo", "Community templates", "Email support"], cta: "Start free" },
  { name: PLAN_META.pro.label, price: `$${PLAN_META.pro.priceAmount.monthly}`, period: "/ mo", features: ["25 active workflows", "150k credits / mo", "AI Copilot + self-heal", "Priority support"], cta: "Start Pro", featured: true },
  { name: PLAN_META.business.label, price: `$${PLAN_META.business.priceAmount.monthly}`, period: "/ mo", features: ["Unlimited workflows", "1M credits / mo", "RBAC + audit logs", "SSO ready"], cta: "Start Business" },
  { name: "Enterprise", price: "Custom", period: "", features: ["Self-hosted option", "Dedicated support", "SLA + uptime", "Custom nodes"], cta: "Contact sales" },
];

export default async function LandingPage() {
  const session = await auth();
  const dashboardHref = session?.user ? "/dashboard" : "/signup";

  return (
    <div className="min-h-screen">
      <MarketingNav />

      <section className="relative overflow-hidden pt-32 pb-24 lg:pt-40 lg:pb-32">
        <HeroBackground />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-14 lg:gap-12 xl:gap-16 items-center">
          <div className="text-center lg:text-left lg:self-start">
            <HeroFade y={12} duration={0.5}>
              <Badge
                tone="brand"
                className="lg:mx-0 mx-auto bg-surface-2/80 text-brand backdrop-blur-sm border-brand/40 shadow-[0_0_24px_-6px_rgba(124,92,255,0.55)]"
              >
                <span className="dot dot-live bg-brand mr-1.5" />
                The AI-Native Automation Platform
              </Badge>
            </HeroFade>

            <HeroFade y={16} duration={0.6} delay={0.08}>
              <h1 className="mt-7 text-balance text-3xl font-semibold tracking-tight sm:text-4xl lg:text-5xl xl:text-6xl">
                Build, Deploy &amp; Scale
                <br />
                Autonomous <span className="text-anim-gradient">AI Agents</span>
                <br />
                Without Limits.
              </h1>
            </HeroFade>

            <HeroFade y={16} duration={0.6} delay={0.16}>
              <p className="mx-auto lg:mx-0 mt-7 max-w-xl text-pretty text-lg text-fg-muted">
                AgentFlow AI is the AI-native automation platform for building, deploying, and scaling
                autonomous agents that think, remember, and self-heal — without writing glue code or
                managing infrastructure.
              </p>
            </HeroFade>

            <HeroFade y={16} duration={0.6} delay={0.24}>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-3.5">
                <Link href={dashboardHref} className="w-full sm:w-auto">
                  <Button size="lg" variant="ai" className="btn-shine w-full sm:w-auto">
                    <Icon name="Sparkles" className="h-4 w-4" /> Start Building Free
                  </Button>
                </Link>
                <Link href="/contact" className="w-full sm:w-auto">
                  <Button size="lg" variant="secondary" className="btn-shine w-full sm:w-auto">
                    <Icon name="Calendar" className="h-4 w-4" /> Book Demo
                  </Button>
                </Link>
              </div>
            </HeroFade>

            <div className="mt-7 flex flex-wrap items-center justify-center lg:justify-start gap-x-6 gap-y-2 text-xs text-fg-subtle">
              {[
                { icon: "CreditCard", text: "No credit card" },
                { icon: "ShieldCheck", text: "Enterprise Ready" },
                { icon: "Zap", text: "Deploy in minutes" },
              ].map((c, i) => (
                <HeroFade key={c.text} y={8} duration={0.5} delay={0.34 + i * 0.1}>
                  <span className="inline-flex items-center gap-1.5">
                    <Icon name={c.icon} className="h-3.5 w-3.5 text-success" /> {c.text}
                  </span>
                </HeroFade>
              ))}
            </div>
          </div>

          <HeroFade y={24} duration={0.8} delay={0.3} className="relative">
            <HeroWorkflow />
          </HeroFade>
        </div>
      </section>

      <TrustLogos />

      <section className="border-b border-border bg-bg-soft/30">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-14">
          <Metrics />
        </div>
      </section>

      <section id="features" className="relative mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
        <BlurReveal className="max-w-2xl">
          <Badge tone="ai" className="mb-4">Platform</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything you need to ship <span className="text-fg-muted">autonomous agents.</span>
          </h2>
          <p className="mt-5 text-fg-muted">
            A complete AI-native runtime — from the visual builder to long-term memory, multi-agent
            execution, and enterprise-grade security.
          </p>
        </BlurReveal>
        <FeatureCards />
      </section>

      <section className="relative overflow-hidden border-y border-border">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
          <BlurReveal className="mx-auto max-w-2xl text-center">
            <Badge tone="brand" className="mb-4">Live Preview</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              See it run, in real time.
            </h2>
            <p className="mt-5 text-fg-muted">
              A live look at the AgentFlow production console — executions streaming, agents reasoning,
              memory curating, and the copilot optimizing cost as you watch.
            </p>
          </BlurReveal>
          <div className="mt-14">
            <LivePreview />
          </div>
        </div>
      </section>

      <section id="ai" className="relative mesh-bg border-b border-border">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
          <div className="grid grid-cols-1 gap-14 lg:grid-cols-2 lg:gap-16 lg:items-center">
            <BlurReveal>
              <Badge tone="ai" className="mb-4">Natural-language builder</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Describe it. Ship it.</h2>
              <p className="mt-5 text-fg-muted">
                Type what you want in plain English. The planner agent decomposes your request, picks the
                right nodes, connects them with validated edges, and hands you a working workflow — with a
                copilot ready to optimize cost, latency, and reliability.
              </p>
              <div className="mt-8 glass rounded-xl border border-border p-5">
                <div className="flex items-center gap-2 text-xs text-fg-subtle mb-2">
                  <Icon name="User" className="h-3.5 w-3.5" /> you
                </div>
                <p className="text-sm">“When an invoice arrives in Gmail: extract the data, save to Postgres, upload to S3, notify Slack, and generate a monthly report.”</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-ai">
                  <Icon name="Sparkles" className="h-3.5 w-3.5" /> AgentFlow
                </div>
                <p className="text-sm text-fg-muted">Built a 7-node workflow with a Schedule trigger, Claude extraction, OCR backup, and a monthly report branch. Ready to run? <span className="text-brand">Yes</span></p>
              </div>
            </BlurReveal>
            <BlurReveal delay={0.1}>
              <div className="glass-strong rounded-2xl border border-border p-6 shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between text-xs text-fg-subtle mb-5">
                  <span>Planner Agent</span>
                  <span className="flex items-center gap-1.5 text-success"><span className="dot dot-live bg-success" /> reasoning</span>
                </div>
                <div className="space-y-3.5">
                  {["Parse user intent", "Decompose into 6 tasks", "Map tasks to nodes", "Validate connections", "Estimate cost · $4.20 · ~3m"].map((s, i) => (
                    <div key={s} className="flex items-center gap-3">
                      <span className={`grid h-6 w-6 place-items-center rounded-full ${i < 4 ? "bg-success/15 text-success" : "bg-surface-3 text-fg-subtle"}`}>
                        <Icon name={i < 4 ? "Check" : "Clock"} className="h-3 w-3" />
                      </span>
                      <span className="text-sm">{s}</span>
                      {i < 4 && <span className="ml-auto text-[10px] text-fg-subtle">{(i + 1) * 0.4}s</span>}
                    </div>
                  ))}
                </div>
                <div className="mt-5 h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-brand to-ai" />
                </div>
              </div>
            </BlurReveal>
          </div>
        </div>
      </section>

      <section id="nodes" className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
        <BlurReveal className="max-w-2xl">
          <Badge tone="brand" className="mb-4">Node Library</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">200+ integrations. One canvas.</h2>
          <p className="mt-5 text-fg-muted">Drop any node onto the canvas — communications, AI models, storage, documents, clouds, and utilities. Every node exposes inputs, outputs, settings, logs, and retry.</p>
        </BlurReveal>
        <div className="mt-14 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {Object.entries(CATEGORY_META).map(([key, meta], gi) => (
            <FadeIn key={key} delay={gi * 0.04}>
              <div className="glass rounded-xl border border-border p-5 h-full">
                <div className="flex items-center gap-2 mb-3.5">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: meta.color }} />
                  <span className="text-sm font-semibold">{meta.label}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {NODE_LIBRARY.filter((n) => n.category === key).map((n) => (
                    <span key={n.type} className="inline-flex items-center gap-1 rounded-md border border-border bg-surface-2/60 px-2 py-1 text-[11px] text-fg-muted">
                      <Icon name={n.icon} className="h-3 w-3" style={{ color: n.color }} />
                      {n.label}
                    </span>
                  ))}
                </div>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      <section id="pricing" className="border-t border-border bg-bg-soft/40">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
          <BlurReveal className="text-center max-w-2xl mx-auto">
            <Badge tone="ai" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Credit-based, scales with you</h2>
            <p className="mt-5 text-fg-muted">Start free. Upgrade when your automations outgrow it. Stripe-powered billing.</p>
          </BlurReveal>
          <div className="mt-14 grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-4">
            {plans.map((p, i) => (
              <FadeIn key={p.name} delay={i * 0.05}>
                <div className={`card-hover h-full rounded-xl border p-5 ${p.featured ? "border-brand/50 bg-brand-soft/30 shadow-[0_8px_40px_-12px_rgba(124,92,255,0.5)]" : "glass border-border"}`}>
                  {p.featured && <Badge tone="brand" className="mb-3">Most popular</Badge>}
                  <div className="text-sm font-semibold text-fg-muted">{p.name}</div>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-semibold tracking-tight">{p.price}</span>
                    <span className="text-xs text-fg-subtle">{p.period}</span>
                  </div>
                  <ul className="mt-4 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-fg-muted">
                        <Icon name="Check" className="h-3.5 w-3.5 text-success" /> {f}
                      </li>
                    ))}
                  </ul>
                  <Link href="/signup" className="block mt-5">
                    <Button variant={p.featured ? "ai" : "secondary"} size="sm" className="w-full">{p.cta}</Button>
                  </Link>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 lg:px-8 py-24 lg:py-32">
        <BlurReveal className="relative overflow-hidden rounded-3xl border border-border mesh-bg p-12 text-center lg:p-20">
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Automate like you mean it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-fg-muted">Spin up your first AI-native workflow in minutes. Free to start, no card required.</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup"><Button size="lg" variant="ai" className="btn-shine"><Icon name="Rocket" className="h-4 w-4" /> Get started free</Button></Link>
              <Link href="/dashboard"><Button size="lg" variant="secondary" className="btn-shine"><Icon name="LayoutDashboard" className="h-4 w-4" /> View live demo</Button></Link>
            </div>
          </div>
        </BlurReveal>
      </section>

      <Footer />
    </div>
  );
}