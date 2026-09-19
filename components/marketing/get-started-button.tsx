"use client";

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
      {/* Soft blue glow — sits behind the button and breathes. */}
      <span
        aria-hidden
        className="cta-glow pointer-events-none absolute -inset-1 rounded-[13px] bg-brand opacity-35 blur-md transition-opacity duration-300 group-hover:opacity-60"
      />

      {/* Primary CTA — solid electric blue. */}
      <Link
        href={href}
        className="relative inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-medium text-white shadow-[0_8px_24px_-10px_rgba(33,150,243,0.6)] transition-colors duration-300 group-hover:bg-brand-2 focus-ring"
      >
        <span>{label}</span>
        <motion.span
          aria-hidden
          initial={false}
          whileHover={{ x: 1.5 }}
        >
          <Icon name="ArrowRight" className="h-3.5 w-3.5" />
        </motion.span>
      </Link>
    </motion.div>
  );
}