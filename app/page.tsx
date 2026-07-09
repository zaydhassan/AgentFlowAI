// Server component landing page. Checks auth state so the primary CTA
// ("Open the dashboard") routes signed-in users to /dashboard directly and
// anonymous users to /signup (deep-link friendly). The animated wrappers
// live in components/marketing/motion.tsx (a client component) so this
// file can stay a server component and use `await auth()`.
import Link from "next/link";
import { FadeIn, HeroFade } from "@/components/marketing/motion";
import { MarketingNav } from "@/components/marketing/nav";
import { Footer } from "@/components/marketing/footer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { NODE_LIBRARY, CATEGORY_META } from "@/lib/nodes";
import { auth } from "@/auth";

const capabilities = [
  { icon: "Brain", title: "Think", desc: "LLMs reason over every step, not just at the end." },
  { icon: "Workflow", title: "Plan", desc: "A planner agent decomposes large requests into tasks." },
  { icon: "Sparkles", title: "Reason", desc: "Transparent reasoning traces on every node." },
  { icon: "Database", title: "Remember", desc: "Long-term memory across runs, users, and context." },
  { icon: "Wrench", title: "Self-heal", desc: "Diagnose failures, refresh creds, retry safely." },
  { icon: "Repeat", title: "Retry smartly", desc: "Exponential backoff with idempotency guards." },
  { icon: "Gauge", title: "Optimize", desc: "Copilot suggests cheaper, faster routing." },
  { icon: "Route", title: "Route", desc: "AI Router picks the best model per task." },
];

const aiSteps = [
  { icon: "Mail", label: "Gmail: invoice arrives", color: "#ef4444" },
  { icon: "Sparkles", label: "Claude: extract fields", color: "#d97706" },
  { icon: "Database", label: "Postgres: insert row", color: "#336791" },
  { icon: "Cloud", label: "S3: archive PDF", color: "#ff9900" },
  { icon: "MessageSquare", label: "Slack: notify #finance", color: "#a855f7" },
  { icon: "FileText", label: "Prompt: monthly report", color: "#8b5cf6" },
];

const stats = [
  { value: "184k+", label: "Executions today" },
  { value: "98.2%", label: "Success rate" },
  { value: "60+", label: "Node integrations" },
  { value: "<40ms", label: "Webhook latency p99" },
];

const plans = [
  { name: "Free", price: "$0", period: "forever", features: ["3 active workflows", "1,000 credits / mo", "Community templates", "Email support"], cta: "Start free" },
  { name: "Pro", price: "$29", period: "/ mo", features: ["25 active workflows", "150k credits / mo", "AI Copilot + self-heal", "Priority support"], cta: "Start Pro", featured: true },
  { name: "Business", price: "$99", period: "/ mo", features: ["Unlimited workflows", "1M credits / mo", "RBAC + audit logs", "SSO ready"], cta: "Start Business" },
  { name: "Enterprise", price: "Custom", period: "", features: ["Self-hosted option", "Dedicated support", "SLA + uptime", "Custom nodes"], cta: "Contact sales" },
];

export default async function LandingPage() {
  const session = await auth();
  const dashboardHref = session?.user ? "/dashboard" : "/signup";

  return (
    <div className="min-h-screen">
      <MarketingNav />

      {/* HERO */}
      <section className="relative mesh-bg overflow-hidden pt-32 pb-24 lg:pt-40">
        <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(70%_60%_at_50%_0%,#000,transparent)]" />
        <div className="relative mx-auto max-w-7xl px-5 lg:px-8 text-center">
          <HeroFade y={12} duration={0.5}>
            <Badge tone="brand" className="mx-auto mb-6">
              <span className="dot dot-live bg-brand mr-1.5" />
              The AI-Native Automation Platform
            </Badge>
          </HeroFade>
          <HeroFade y={16} duration={0.6} delay={0.05}>
            <h1 className="text-balance text-5xl font-semibold tracking-tight sm:text-6xl lg:text-7xl">
              Workflows that <span className="text-gradient">think</span>,
              <br className="hidden sm:block" /> plan, and <span className="text-brand-gradient">self-heal</span>
            </h1>
          </HeroFade>
          <HeroFade y={16} duration={0.6} delay={0.15}>
            <p className="mx-auto mt-6 max-w-2xl text-pretty text-lg text-fg-muted">
              Build intelligent automations visually — where AI is the engine, not a bolt-on. Reason over every
              step, recover from failures automatically, and let a copilot optimize cost and architecture.
            </p>
          </HeroFade>
          <HeroFade y={16} duration={0.6} delay={0.25}>
            <div className="mt-9 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href={dashboardHref}>
                <Button size="lg" variant="ai">
                  <Icon name="Sparkles" className="h-4 w-4" /> {session?.user ? "Open the dashboard" : "Get started free"}
                </Button>
              </Link>
              <Link href="/ai">
                <Button size="lg" variant="secondary">
                  <Icon name="Wand2" className="h-4 w-4" /> Build with natural language
                </Button>
              </Link>
            </div>
          </HeroFade>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-fg-subtle">
            <Icon name="Check" className="h-3.5 w-3.5 text-success" /> No credit card
            <span className="text-fg-subtle/40">•</span>
            <Icon name="Check" className="h-3.5 w-3.5 text-success" /> 1,000 free credits
          </div>
        </div>

        {/* Floating workflow preview */}
        <HeroFade y={30} duration={0.8} delay={0.4} className="relative mx-auto mt-16 max-w-5xl px-5">
          <div className="glass-strong rounded-2xl border border-border shadow-2xl shadow-black/50 overflow-hidden">
            <div className="flex items-center gap-2 border-b border-border px-4 py-3">
              <span className="h-3 w-3 rounded-full bg-danger/70" />
              <span className="h-3 w-3 rounded-full bg-warning/70" />
              <span className="h-3 w-3 rounded-full bg-success/70" />
              <span className="ml-3 text-xs text-fg-subtle">Invoice Processing · v12</span>
              <span className="ml-auto flex items-center gap-1.5 text-[11px] text-success">
                <span className="dot dot-live bg-success" /> running
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3 p-5 md:grid-cols-3 lg:grid-cols-6">
              {aiSteps.map((s, i) => (
                <div key={i} className="relative">
                  <div className="glass rounded-xl border border-border p-3 text-center">
                    <div className="mx-auto grid h-9 w-9 place-items-center rounded-lg" style={{ background: `${s.color}22`, color: s.color }}>
                      <Icon name={s.icon} className="h-4 w-4" />
                    </div>
                    <div className="mt-2 text-[10px] leading-tight text-fg-muted">{s.label}</div>
                  </div>
                  {i < aiSteps.length - 1 && (
                    <Icon name="ArrowRight" className="absolute -right-2.5 top-1/2 hidden h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle md:block" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </HeroFade>
      </section>

      {/* Trust / stats */}
      <section className="border-y border-border bg-bg-soft/40">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-10 grid grid-cols-2 gap-6 md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight text-brand-gradient">{s.value}</div>
              <div className="mt-1 text-xs text-fg-subtle">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Capabilities */}
      <section id="features" className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
        <FadeIn className="max-w-2xl">
          <Badge tone="ai" className="mb-4">Why AgentFlow</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Not automation with AI. <span className="text-fg-muted">AI as the engine.</span></h2>
          <p className="mt-4 text-fg-muted">Every workflow runs inside an AI runtime that reasons, remembers, and recovers — so your automations keep working when the world changes.</p>
        </FadeIn>
        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {capabilities.map((c, i) => (
            <FadeIn key={c.title} delay={i * 0.05}>
              <div className="card-hover glass h-full rounded-xl p-5">
                <div className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand">
                  <Icon name={c.icon} className="h-5 w-5" />
                </div>
                <h3 className="mt-4 text-sm font-semibold">{c.title}</h3>
                <p className="mt-1.5 text-sm text-fg-muted">{c.desc}</p>
              </div>
            </FadeIn>
          ))}
        </div>
      </section>

      {/* AI engine section */}
      <section id="ai" className="relative mesh-bg border-y border-border">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            <FadeIn>
              <Badge tone="ai" className="mb-4">Natural-language builder</Badge>
              <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Describe it. Ship it.</h2>
              <p className="mt-4 text-fg-muted">
                Type what you want in plain English. The planner agent decomposes your request, picks the right
                nodes, connects them with validated edges, and hands you a working workflow — with a copilot
                ready to optimize cost, latency, and reliability.
              </p>
              <div className="mt-6 glass rounded-xl border border-border p-4">
                <div className="flex items-center gap-2 text-xs text-fg-subtle mb-2">
                  <Icon name="User" className="h-3.5 w-3.5" /> you
                </div>
                <p className="text-sm">“When an invoice arrives in Gmail: extract the data, save to Postgres, upload to S3, notify Slack, and generate a monthly report.”</p>
                <div className="mt-3 flex items-center gap-2 text-xs text-ai">
                  <Icon name="Sparkles" className="h-3.5 w-3.5" /> AgentFlow
                </div>
                <p className="text-sm text-fg-muted">Built a 7-node workflow with a Schedule trigger, Claude extraction, OCR backup, and a monthly report branch. Ready to run? <span className="text-brand">Yes</span></p>
              </div>
            </FadeIn>
            <FadeIn delay={0.1}>
              <div className="glass-strong rounded-2xl border border-border p-5 shadow-2xl shadow-black/40">
                <div className="flex items-center justify-between text-xs text-fg-subtle mb-4">
                  <span>Planner Agent</span>
                  <span className="flex items-center gap-1.5 text-success"><span className="dot dot-live bg-success" /> reasoning</span>
                </div>
                <div className="space-y-3">
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
                <div className="mt-4 h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full w-[80%] rounded-full bg-gradient-to-r from-brand to-ai" />
                </div>
              </div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Node library */}
      <section id="nodes" className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
        <FadeIn className="max-w-2xl">
          <Badge tone="brand" className="mb-4">Node Library</Badge>
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">60+ integrations. One canvas.</h2>
          <p className="mt-4 text-fg-muted">Drop any node onto the canvas — communications, AI models, storage, documents, clouds, and utilities. Every node exposes inputs, outputs, settings, logs, and retry.</p>
        </FadeIn>
        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {Object.entries(CATEGORY_META).map(([key, meta], gi) => (
            <FadeIn key={key} delay={gi * 0.04}>
              <div className="glass rounded-xl border border-border p-4 h-full">
                <div className="flex items-center gap-2 mb-3">
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

      {/* Pricing teaser */}
      <section id="pricing" className="border-t border-border bg-bg-soft/40">
        <div className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
          <FadeIn className="text-center max-w-2xl mx-auto">
            <Badge tone="ai" className="mb-4">Pricing</Badge>
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Credit-based, scales with you</h2>
            <p className="mt-4 text-fg-muted">Start free. Upgrade when your automations outgrow it. Stripe-powered billing.</p>
          </FadeIn>
          <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
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

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-5 lg:px-8 py-24">
        <FadeIn className="relative overflow-hidden rounded-3xl border border-border mesh-bg p-12 text-center lg:p-20">
          <div className="relative">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-5xl">Automate like you mean it.</h2>
            <p className="mx-auto mt-4 max-w-xl text-fg-muted">Spin up your first AI-native workflow in minutes. Free to start, no card required.</p>
            <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup"><Button size="lg" variant="ai"><Icon name="Rocket" className="h-4 w-4" /> Get started free</Button></Link>
              <Link href="/dashboard"><Button size="lg" variant="secondary"><Icon name="LayoutDashboard" className="h-4 w-4" /> View live demo</Button></Link>
            </div>
          </div>
        </FadeIn>
      </section>

      <Footer />
    </div>
  );
}
