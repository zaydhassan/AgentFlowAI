"use client";

// Security pillar card for the /security landing page.
//
// Restraint over flash — the Stripe / Vercel / Linear register, not a gaming
// dashboard: solid dark surface, a soft 1px border, a quiet 2px purple→cyan
// accent at the top, a small purple icon tile, and a gentle hover.
//
// Framer Motion is used ONLY for the hover lift (-4px) and the icon scale
// (1.05). The border brightening and soft shadow are plain CSS transitions so
// the interaction stays understated. Content (icon/title/body) is owned by the
// page; this component only renders presentation. h-full keeps cards equal
// height within the grid row; the page's grid wrapper handles responsiveness.

import { motion, type Variants } from "framer-motion";
import { Icon } from "@/components/ui/icon";

export type SecurityPillar = {
  icon: string;
  title: string;
  body: string;
};

// "rest" / "hover" labels propagate from the card's whileHover to the icon, so
// a single hover drives both the lift and the icon scale.
const cardVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -4 },
};

const iconVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
};

const MOTION_transition = { duration: 0.2, ease: "easeOut" as const };

export function SecurityPillarCard({ icon, title, body }: SecurityPillar) {
  return (
    <motion.div
      variants={cardVariants}
      initial="rest"
      animate="rest"
      whileHover="hover"
      transition={MOTION_transition}
      className="relative h-full overflow-hidden rounded-2xl border border-[#2A2A38] bg-surface-2 p-6 transition-[border-color,box-shadow] duration-200 ease-out hover:border-[#363645] hover:shadow-[0_12px_30px_rgba(0,0,0,0.25)]"
    >
      {/* 2px purple→cyan accent at the top. */}
      <div
        className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand to-ai"
        aria-hidden
      />

      {/* Small rounded icon tile with a subtle purple background. */}
      <motion.div
        variants={iconVariants}
        transition={MOTION_transition}
        className="grid h-10 w-10 place-items-center rounded-lg bg-brand-soft text-brand"
      >
        <Icon name={icon} className="h-7 w-7" />
      </motion.div>

      <h3 className="mt-4 text-base font-bold leading-snug tracking-tight">{title}</h3>
      <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">{body}</p>
    </motion.div>
  );
}