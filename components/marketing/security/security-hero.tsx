"use client";

import { motion, useReducedMotion } from "framer-motion";
import { HeroFade } from "@/components/marketing/motion";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";

// Floating trust labels — symmetric, evenly spaced around the shield.
const LABELS = [
  { text: "Secure", pos: "left-[2%] top-[22%]", delay: 0 },
  { text: "Private", pos: "right-[2%] top-[22%]", delay: 1.2 },
  { text: "Compliant", pos: "left-[2%] bottom-[22%]", delay: 2.1 },
  { text: "Trusted", pos: "right-[2%] bottom-[22%]", delay: 1.6 },
] as const;

export function SecurityHero({ description }: { description: string }) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden">
      {/* Hero ambience: purple glow left, cyan glow right, faded grid. */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(42% 50% at 8% 25%, rgba(124,92,255,0.12), transparent 70%), radial-gradient(38% 48% at 90% 30%, rgba(34,211,238,0.09), transparent 70%)",
          }}
        />
        <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(75%_70%_at_50%_35%,#000,transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-b from-transparent to-bg" />
      </div>

      <div className="relative mx-auto grid w-full max-w-7xl items-center gap-14 px-5 pb-20 pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,440px)] lg:gap-16 lg:px-8 lg:pt-24">
        <div className="text-center lg:text-left">
          <HeroFade>
            <Badge tone="ai">Security</Badge>
          </HeroFade>
          <HeroFade delay={0.08}>
            <h1 className="text-balance mt-5 text-4xl font-semibold tracking-tight sm:text-5xl">
              Security is a{" "}
              <span className="text-brand-gradient">prerequisite</span>, not a feature
            </h1>
          </HeroFade>
          <HeroFade delay={0.16}>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg lg:mx-0">
              {description}
            </p>
          </HeroFade>
        </div>

        <ShieldVisual reduceMotion={reduceMotion} />
      </div>
    </section>
  );
}

// Abstract security visual: glowing shield core inside two static concentric
// rings, with four symmetric floating trust labels. Motion is kept to a
// gentle float, gated by reduced-motion.
function ShieldVisual({ reduceMotion }: { reduceMotion: boolean | null }) {
  return (
    <HeroFade delay={0.2} className="relative mx-auto w-full max-w-[380px]">
      <div className="relative aspect-square">
        {/* Ambient glows behind the shield. */}
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background:
              "radial-gradient(50% 50% at 50% 45%, rgba(124,92,255,0.16), transparent 70%), radial-gradient(35% 35% at 65% 65%, rgba(34,211,238,0.10), transparent 70%)",
          }}
        />

        {/* Concentric rings. */}
        <div className="absolute inset-[8%] rounded-full border border-brand/15" aria-hidden />
        <div
          className="absolute inset-[20%] rounded-full border border-ai/10"
          style={{ borderStyle: "dashed" }}
          aria-hidden
        />

        {/* Shield core. */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
          animate={reduceMotion ? {} : { y: [-5, 5, -5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        >
          <div className="grid h-24 w-24 place-items-center rounded-3xl bg-gradient-to-br from-brand via-brand-2 to-ai shadow-[0_0_60px_-8px_rgba(124,92,255,0.7)] ring-1 ring-inset ring-white/15">
            <span className="pointer-events-none absolute inset-0 rounded-2xl bg-gradient-to-b from-white/25 to-transparent" />
            <Icon name="ShieldCheck" className="h-11 w-11 text-white" strokeWidth={1.5} />
          </div>
        </motion.div>

        {/* Floating trust labels — static positions, gentle drift. */}
        {LABELS.map((l) => (
          <motion.span
            key={l.text}
            aria-hidden
            className={`absolute ${l.pos} rounded-full border border-border bg-surface-2/80 px-3 py-1 text-[11px] font-medium text-fg-muted backdrop-blur-sm`}
            animate={reduceMotion ? {} : { y: [0, -4, 0] }}
            transition={{ duration: 5 + l.delay, delay: l.delay, repeat: Infinity, ease: "easeInOut" }}
          >
            <span className="mr-1.5 inline-block h-1.5 w-1.5 rounded-full bg-gradient-to-br from-brand to-ai align-middle" />
            {l.text}
          </motion.span>
        ))}
      </div>
    </HeroFade>
  );
}