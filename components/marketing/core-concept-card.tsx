"use client";

import Link from "next/link";
import { motion, type Variants } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export type ConceptTone = "brand" | "ai" | "success" | "warning";

export type CoreConcept = {
  icon: string;
  category: string;
  title: string;
  body: string;
  bullets: string[];
  href: string;
  tone: ConceptTone;
};

const DOT_TONE: Record<ConceptTone, string> = {
  brand: "bg-brand",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
};

const cardVariants: Variants = {
  rest: { y: 0 },
  hover: { y: -5 },
};

const iconVariants: Variants = {
  rest: { scale: 1 },
  hover: { scale: 1.05 },
};

const arrowVariants: Variants = {
  rest: { x: 0 },
  hover: { x: 4 },
};

const HOVER_TRANSITION = { duration: 0.2, ease: "easeOut" as const };

export function CoreConceptCard({ concept, index }: { concept: CoreConcept; index: number }) {
  const { icon, category, title, body, bullets, href, tone } = concept;
  return (
    // OUTER: viewport fade-up, staggered by index. No hover here.
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, ease: "easeOut", delay: index * 0.08 }}
      className="h-full"
    >
      {/* INNER: owns hover lift (variant label propagates to icon + arrow). */}
      <motion.div
        variants={cardVariants}
        initial="rest"
        animate="rest"
        whileHover="hover"
        transition={HOVER_TRANSITION}
        className={cn(
          "group relative flex h-full flex-col overflow-hidden rounded-[20px] border border-[#27272F] bg-surface-2 p-8",
          "transition-[border-color,box-shadow] duration-200 ease-out",
          "hover:border-[#34343F] hover:shadow-[0_18px_40px_-12px_rgba(0,0,0,0.35)]",
        )}
      >
        {/* 52px icon tile with a very soft purple background. */}
        <motion.div
          variants={iconVariants}
          transition={HOVER_TRANSITION}
          className="grid h-[52px] w-[52px] place-items-center rounded-2xl bg-brand-soft text-brand"
        >
          <Icon name={icon} className="h-6 w-6" strokeWidth={1.75} />
        </motion.div>

        {/* Small uppercase category label. */}
        <div className="mt-7 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
          {category}
        </div>

        {/* Title with a tiny status dot beside it. */}
        <div className="mt-2.5 flex items-center gap-2.5">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[tone])} aria-hidden />
          <h3 className="text-lg font-bold leading-tight tracking-tight text-fg">{title}</h3>
        </div>

        {/* Description — width-capped for comfortable reading. */}
        <p className="mt-3 max-w-[42ch] text-sm leading-relaxed text-fg-muted">{body}</p>

        {/* Capability bullets. */}
        <ul className="mt-5 space-y-2.5">
          {bullets.map((b) => (
            <li key={b} className="flex items-center gap-2.5 text-sm text-fg/90">
              <Icon name="Check" className="h-3.5 w-3.5 shrink-0 text-brand" strokeWidth={2.5} />
              <span>{b}</span>
            </li>
          ))}
        </ul>

        {/* Learn more link — pinned to the bottom so cards align. */}
        <div className="mt-auto pt-7">
          <Link
            href={href}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-brand transition-opacity hover:opacity-80"
          >
            Learn more
            <motion.span variants={arrowVariants} transition={HOVER_TRANSITION} className="inline-flex">
              <Icon name="ArrowRight" className="h-4 w-4" />
            </motion.span>
          </Link>
        </div>
      </motion.div>
    </motion.div>
  );
}