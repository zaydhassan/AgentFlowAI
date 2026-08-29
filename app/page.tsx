import Link from "next/link";
import { HeroFade, BlurReveal } from "@/components/marketing/motion";
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
import { NodeLibrary } from "@/components/marketing/node-library";
import { NaturalLanguageBuilder } from "@/components/marketing/nl-builder";
import { RuntimeHubSection } from "@/components/marketing/runtime-hub";
import { auth } from "@/auth";

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

      <section id="ai" className="relative border-b border-border">
        <NaturalLanguageBuilder />
      </section>

      <section id="nodes" className="relative overflow-hidden border-t border-border">
        <NodeLibrary ctaHref={dashboardHref} />
      </section>

      <RuntimeHubSection />

      <Footer />
    </div>
  );
}