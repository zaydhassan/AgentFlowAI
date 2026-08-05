"use client";

// Cinematic hero background — subtle only.
// Grid + soft radials render as plain JSX (SSR-safe). Particles use
// framer-motion transform-only loops (no rerenders) with deterministic
// positions so there is no hydration mismatch.

import { motion } from "framer-motion";

// Deterministic particle field (no Math.random at render).
const PARTICLES = [
  { left: "8%", top: "22%", size: 3, delay: 0, color: "var(--color-brand)", dur: 7 },
  { left: "20%", top: "68%", size: 2, delay: 1.2, color: "var(--color-ai)", dur: 8 },
  { left: "34%", top: "30%", size: 4, delay: 0.6, color: "var(--color-brand-2)", dur: 9 },
  { left: "46%", top: "82%", size: 2, delay: 2.1, color: "var(--color-brand)", dur: 7.5 },
  { left: "58%", top: "18%", size: 3, delay: 0.3, color: "var(--color-ai)", dur: 8.5 },
  { left: "68%", top: "58%", size: 2, delay: 1.7, color: "var(--color-brand-2)", dur: 6.5 },
  { left: "78%", top: "36%", size: 4, delay: 2.4, color: "var(--color-brand)", dur: 9.5 },
  { left: "88%", top: "72%", size: 2, delay: 0.9, color: "var(--color-ai)", dur: 7.8 },
  { left: "14%", top: "44%", size: 2, delay: 1.5, color: "var(--color-brand-2)", dur: 8.2 },
  { left: "40%", top: "54%", size: 3, delay: 2.8, color: "var(--color-brand)", dur: 6.8 },
  { left: "52%", top: "40%", size: 2, delay: 0.4, color: "var(--color-ai)", dur: 9.2 },
  { left: "74%", top: "84%", size: 3, delay: 1.1, color: "var(--color-brand-2)", dur: 7.4 },
  { left: "92%", top: "48%", size: 2, delay: 2.0, color: "var(--color-brand)", dur: 8.6 },
  { left: "28%", top: "12%", size: 2, delay: 1.9, color: "var(--color-ai)", dur: 7.2 },
  { left: "62%", top: "92%", size: 3, delay: 0.7, color: "var(--color-brand-2)", dur: 9.8 },
  { left: "84%", top: "14%", size: 2, delay: 2.5, color: "var(--color-brand)", dur: 6.6 },
];

export function HeroBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {/* Soft radial base — premium vignette, no harsh mesh. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 0%, rgba(124,92,255,0.10), transparent 70%), radial-gradient(40% 40% at 80% 30%, rgba(34,211,238,0.08), transparent 70%)",
        }}
      />

      {/* Fine grid with a radial fade mask. */}
      <div className="grid-overlay absolute inset-0 [mask-image:radial-gradient(75%_65%_at_50%_30%,#000,transparent)]" />

      {/* Aurora blobs. */}
      <div className="aurora-blob aurora-1" style={{ width: 480, height: 480, top: "-8%", left: "-6%" }} />
      <div className="aurora-blob aurora-2" style={{ width: 420, height: 420, top: "20%", right: "-8%" }} />
      <div className="aurora-blob aurora-3" style={{ width: 360, height: 360, bottom: "-12%", left: "35%" }} />

      {/* Orbital rings. */}
      <div className="orbital-ring" style={{ width: 520, height: 520, top: "8%", left: "calc(50% - 260px)" }} />
      <div
        className="orbital-ring"
        style={{ width: 720, height: 720, top: "-6%", left: "calc(50% - 360px)", animationDirection: "reverse", opacity: 0.6 }}
      />

      {/* Moving light rays. */}
      <div className="light-ray" style={{ top: "28%", transform: "rotate(-18deg)" }} />
      <div className="light-ray" style={{ top: "62%", transform: "rotate(12deg)", animationDelay: "3s" }} />

      {/* Glowing particles. */}
      {PARTICLES.map((p, i) => (
        <motion.span
          key={i}
          className="absolute rounded-full"
          style={{
            left: p.left,
            top: p.top,
            width: p.size,
            height: p.size,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.size}px`,
            // boxShadow color: keep subtle; use currentColor-ish via box-shadow on bg
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.9, 0],
            y: [0, -16, 0],
          }}
          transition={{
            duration: p.dur,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Bottom fade into the page background for a seamless seam. */}
      <div
        className="absolute inset-x-0 bottom-0 h-32"
        style={{ background: "linear-gradient(to bottom, transparent, var(--color-bg))" }}
      />
    </div>
  );
}