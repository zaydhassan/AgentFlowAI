"use client";

import { motion, useReducedMotion } from "framer-motion";

// Deterministic particle positions (no Math.random at render — hydration-safe).
const PARTICLES = [
  { left: "6%", top: "18%", size: 2, delay: 0.3, dur: 9 },
  { left: "16%", top: "58%", size: 3, delay: 1.6, dur: 8 },
  { left: "28%", top: "34%", size: 2, delay: 0.8, dur: 10 },
  { left: "47%", top: "76%", size: 2, delay: 2.2, dur: 8.6 },
  { left: "63%", top: "22%", size: 3, delay: 0.1, dur: 9.4 },
  { left: "74%", top: "64%", size: 2, delay: 1.2, dur: 7.8 },
  { left: "86%", top: "38%", size: 2, delay: 2.6, dur: 9.1 },
  { left: "94%", top: "80%", size: 2, delay: 1.9, dur: 8.2 },
];

export function DocsBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
      {/* Ambient radial glows — purple left, cyan right. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(42% 34% at 4% 12%, rgba(124,92,255,0.10), transparent 70%), radial-gradient(36% 30% at 96% 18%, rgba(34,211,238,0.08), transparent 70%), radial-gradient(34% 26% at 50% 100%, rgba(91,139,255,0.05), transparent 70%)",
        }}
      />

      {/* Fine technical grid, faded at both ends of the page. */}
      <div className="grid-overlay absolute inset-0 [mask-image:linear-gradient(to_bottom,transparent,#000_8%,#000_85%,transparent)]" />

      {/* Faint node/network lines (static SVG — no canvas, no loop cost). */}
      <svg
        className="absolute right-[4%] top-[16%] hidden w-64 opacity-40 lg:block"
        viewBox="0 0 260 160"
        fill="none"
      >
        <path d="M10 130 L90 90 L160 110 L240 30" stroke="url(#docsNet)" strokeWidth="1" />
        <path d="M90 90 L110 18" stroke="url(#docsNet)" strokeWidth="1" />
        {[
          [10, 130],
          [90, 90],
          [160, 110],
          [240, 30],
          [110, 18],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" className="fill-brand/30" />
        ))}
        <defs>
          <linearGradient id="docsNet" x1="0" y1="0" x2="260" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#7c5cff" stopOpacity="0.25" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.2" />
          </linearGradient>
        </defs>
      </svg>
      <svg
        className="absolute left-[3%] top-[52%] hidden w-52 opacity-30 lg:block"
        viewBox="0 0 200 120"
        fill="none"
      >
        <path d="M8 20 L70 60 L128 34 L188 96" stroke="url(#docsNet2)" strokeWidth="1" />
        {[
          [8, 20],
          [70, 60],
          [128, 34],
          [188, 96],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="2.5" className="fill-ai/25" />
        ))}
        <defs>
          <linearGradient id="docsNet2" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
            <stop stopColor="#22d3ee" stopOpacity="0.22" />
            <stop offset="1" stopColor="#7c5cff" stopOpacity="0.18" />
          </linearGradient>
        </defs>
      </svg>

      {/* Tiny drifting particles (static under reduced motion). */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full bg-fg-subtle"
          style={{ left: p.left, top: p.top, width: p.size, height: p.size }}
          initial={{ opacity: 0 }}
          animate={reduceMotion ? { opacity: 0.2 } : { opacity: [0.08, 0.4, 0.08], y: [0, -10, 0] }}
          transition={
            reduceMotion
              ? { duration: 0.4, delay: p.delay }
              : { duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }
          }
        />
      ))}
    </div>
  );
}