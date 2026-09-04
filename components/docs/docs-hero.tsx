"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HeroFade } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { DocsSearch } from "@/components/docs/docs-search";

// The four stages of the hero's orchestration visual — the same lifecycle the
// page intro describes (design → run → operate, i.e. build → orchestrate →
// deploy → scale).
const STAGES = [
  { icon: "Workflow", label: "Build" },
  { icon: "Sparkles", label: "Orchestrate" },
  { icon: "Rocket", label: "Deploy" },
  { icon: "Server", label: "Scale" },
] as const;

export function DocumentationHero() {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Local hero ambience (kept subtle so the search stays readable). */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(40% 50% at 12% 20%, rgba(124,92,255,0.12), transparent 70%), radial-gradient(36% 46% at 88% 30%, rgba(34,211,238,0.09), transparent 70%)",
          }}
        />
        <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(75%_70%_at_50%_30%,#000,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pb-20 pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,380px)] lg:gap-16 lg:px-8 lg:pt-24">
        <div className="text-center lg:text-left">
          <HeroFade>
            <Badge tone="ai">Documentation</Badge>
          </HeroFade>
          <HeroFade delay={0.08}>
            <h1 className="text-balance mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Core{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: "linear-gradient(110deg, #8b7bff, #5b8bff, #22d3ee)" }}
              >
                Concepts
              </span>
            </h1>
          </HeroFade>
          <HeroFade delay={0.16}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg lg:mx-0">
              Build, orchestrate and deploy autonomous AI systems with enterprise-grade tooling.
              Everything you need to design, run, and operate AI-native workflows — from the
              visual builder to the command line.
            </p>
          </HeroFade>
          <HeroFade delay={0.24}>
            {/* Centered on mobile (matching the centered heading), flush with
                the text edge on desktop. No extra top margin — DocsSearch
                brings its own. */}
            <div className="mx-auto max-w-xl lg:mx-0">
              <DocsSearch />
            </div>
          </HeroFade>
        </div>

        {/* Architecture visual — layered orchestration chain. */}
        <HeroFade delay={0.24} className="relative mx-auto w-full max-w-[340px]">
          <div className="relative overflow-hidden rounded-3xl border border-border bg-surface-2/50 p-6">
            <div
              className="pointer-events-none absolute inset-0"
              aria-hidden
              style={{
                background:
                  "radial-gradient(60% 40% at 20% 0%, rgba(124,92,255,0.14), transparent 70%), radial-gradient(50% 40% at 90% 100%, rgba(34,211,238,0.10), transparent 70%)",
              }}
            />
            <div className="relative">
              <div className="mb-4 text-center text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                Orchestration runtime
              </div>
              <ol className="relative flex flex-col items-stretch gap-0">
                {STAGES.map((s, i) => (
                  <li key={s.label}>
                    {i > 0 && <ConnectorLine delay={i} reduceMotion={reduceMotion} />}
                    <motion.div
                      initial={reduceMotion ? false : { opacity: 0, y: 10 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true }}
                      transition={{ duration: 0.45, delay: 0.3 + i * 0.12 }}
                      className={`relative flex items-center gap-3 rounded-xl border px-4 py-3 ${
                        i % 2 === 0
                          ? "border-brand/25 bg-brand-soft/60"
                          : "border-ai/25 bg-ai/5"
                      }`}
                    >
                      <span
                        className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                          i % 2 === 0 ? "bg-brand/15 text-brand" : "bg-ai/10 text-ai"
                        }`}
                      >
                        <Icon name={s.icon} className="h-4 w-4" aria-hidden />
                      </span>
                      <span className="text-sm font-medium tracking-tight">{s.label}</span>
                      {/* Subtle breathing glow on the node edge. */}
                      <motion.span
                        aria-hidden
                        className="absolute right-3 h-1.5 w-1.5 rounded-full bg-gradient-to-br from-brand to-ai"
                        animate={reduceMotion ? {} : { opacity: [0.4, 1, 0.4] }}
                        transition={{ duration: 3, delay: i * 0.5, repeat: Infinity, ease: "easeInOut" }}
                      />
                    </motion.div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </HeroFade>
      </div>
    </section>
  );
}

// Animated connection line between orchestration stages: a gradient rail with
// a small travelling dot (static under reduced motion).
function ConnectorLine({ delay, reduceMotion }: { delay: number; reduceMotion: boolean | null }) {
  return (
    <div className="relative mx-auto h-7 w-px" aria-hidden>
      <div className="absolute inset-0 bg-gradient-to-b from-brand/50 to-ai/50" />
      {!reduceMotion && (
        <motion.span
          className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-ai shadow-[0_0_8px_2px_rgba(34,211,238,0.5)]"
          initial={{ top: "-4px", opacity: 0 }}
          animate={{ top: ["-4px", "26px"], opacity: [0, 1, 0] }}
          transition={{ duration: 2.2, delay, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
}