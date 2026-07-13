"use client";

// Premium primary CTA for the marketing navbar.
//
// - Gradient hairline border ring (cta-ring) wrapping a dark glass fill,
//   so the action reads as luxurious rather than a flat button.
// - Soft animated glow halo behind it (cta-glow), brightening on hover.
// - Magnetic interaction: the whole button drifts toward the cursor using
//   spring-physics motion values, then snaps back on leave. GPU-only
//   transforms so it stays at 60 FPS.
// - Exposes a normal Next <Link>, so routing/prefetch is unchanged.

import Link from "next/link";
import { useRef } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function GetStartedButton({
  href = "/signup",
  label = "Start free",
  className,
}: {
  href?: string;
  label?: string;
  className?: string;
}) {
  // Magnetic offset motion values, smoothed with a spring so the drift
  // feels weighted, not robotic.
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 320, damping: 22, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 320, damping: 22, mass: 0.6 });

  const ref = useRef<HTMLDivElement>(null);

  function onMove(e: React.MouseEvent) {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    // Distance of the cursor from the element center, normalized.
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    // Pull strength — subtle, ~22% of the normalized distance.
    x.set(dx * 5);
    y.set(dy * 4);
  }

  function reset() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      style={{ x: sx, y: sy }}
      className={cn("group relative", className)}
    >
      {/* Glow halo — sits behind the ring and breathes. */}
      <span
        aria-hidden
        className="cta-glow pointer-events-none absolute -inset-1.5 rounded-[14px] bg-gradient-to-r from-brand via-ai to-brand-2 opacity-50 blur-md transition-opacity duration-300 group-hover:opacity-90"
      />

      {/* Gradient hairline border ring. */}
      <Link
        href={href}
        className="cta-ring relative inline-flex h-9 items-center gap-2 rounded-[11px] p-px text-sm font-medium shadow-[0_8px_24px_-10px_rgba(124,92,255,0.7)] transition-shadow duration-300 group-hover:shadow-[0_12px_32px_-8px_rgba(34,211,238,0.65)] focus-ring"
      >
        {/* Dark glass fill with a faint inner sheen. */}
        <span className="inline-flex h-full w-full items-center justify-center gap-1.5 rounded-[10px] bg-surface-2/90 px-4 text-fg backdrop-blur-md transition-colors duration-300 group-hover:bg-surface-3/90">
          <span>{label}</span>
          <motion.span
            aria-hidden
            initial={false}
            className="text-ai"
            whileHover={{ x: 1.5 }}
          >
            <Icon name="ArrowRight" className="h-3.5 w-3.5" />
          </motion.span>
        </span>
      </Link>
    </motion.div>
  );
}