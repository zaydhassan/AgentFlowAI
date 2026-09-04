"use client";

import { motion, type Variants } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type SecurityCapability = {
  icon: string;
  title: string;
  body: string;
};

const cardVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -4 },
};

const arrowVariants: Variants = {
  rest: { x: -2, opacity: 0 },
  hover: { x: 0, opacity: 1 },
};

const HOVER_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

export function SecurityCapabilityCard({
  capability,
  index,
}: {
  capability: SecurityCapability;
  index: number;
}) {
  const { icon, title, body } = capability;

  return (
    // OUTER: staggered scroll reveal.
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: (index % 3) * 0.08 }}
      className="h-full"
    >
      {/* INNER: hover lift + purple/cyan glow; variant labels drive icon and arrow. */}
      <motion.div
        variants={cardVariants}
        initial="rest"
        animate="rest"
        whileHover="hover"
        transition={HOVER_TRANSITION}
        className="group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-border bg-surface-2/80 p-7 transition-[border-color,box-shadow] duration-200 ease-out hover:border-brand/30 hover:shadow-[0_20px_48px_-16px_rgba(124,92,255,0.3)]"
      >
        {/* Thin gradient accent along the top edge. */}
        <div
          className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-brand/50 via-brand-2/30 to-ai/50 opacity-70 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
        />
        {/* Ambient glow strengthening on hover. */}
        <div
          className="pointer-events-none absolute inset-0 opacity-50 transition-opacity duration-200 group-hover:opacity-100"
          aria-hidden
          style={{
            background:
              "radial-gradient(55% 35% at 12% 0%, rgba(124,92,255,0.09), transparent 70%), radial-gradient(45% 35% at 95% 100%, rgba(34,211,238,0.06), transparent 70%)",
          }}
        />

        <div className="relative flex h-full flex-col">
          <div className="flex items-center justify-between">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-soft text-brand">
              <Icon name={icon} className="h-5 w-5" strokeWidth={1.75} aria-hidden />
            </span>
            {/* Micro-interaction: chevron nudges in on hover. */}
            <Icon
              name="ChevronRight"
              className="h-4 w-4 text-fg-subtle opacity-0 transition-opacity duration-200 group-hover:opacity-100 motion-reduce:transition-none"
              aria-hidden
            />
          </div>

          <h3 className="mt-5 text-base font-bold leading-snug tracking-tight">{title}</h3>
          <p className="mt-2.5 text-sm leading-relaxed text-fg-muted">{body}</p>

          {/* Hover affordance line pinned to the bottom. */}
          <div className="mt-auto pt-6">
            <span
              aria-hidden
              className="block h-px w-full overflow-hidden rounded-full bg-border"
            >
              <motion.span
                variants={arrowVariants}
                transition={HOVER_TRANSITION}
                className="block h-px w-full origin-left bg-gradient-to-r from-brand to-ai"
              />
            </span>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}