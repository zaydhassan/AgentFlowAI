"use client";

// Shared horizontal node-chain visualization (node cards + glow connectors
// with traveling particles). Used by the landing page's natural-language
// builder demo and the About page's architecture flow. Reduced-motion users
// get a static chain (particles omitted, entrance instant).

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

export type FlowNodeItem = { label: string; sub: string; icon: string; color: string };

export function FlowChain({ nodes }: { nodes: FlowNodeItem[] }) {
  const reduceMotion = useReducedMotion();
  return (
    // Own horizontal scroll container — the page itself never overflows.
    <div className="-mx-5 overflow-x-auto px-5 pb-2 lg:mx-0 lg:px-0" style={{ scrollbarWidth: "thin" }}>
      {/* Mobile: shrink-to-fit row inside the scroll container. Desktop:
          the row fills the container and connectors flex, so nodes
          distribute evenly edge-to-edge and never overflow. */}
      <div className="mx-auto flex w-max items-center lg:w-full lg:max-w-6xl">
        {nodes.map((n, i) => (
          <Fragment key={`${n.label}-${i}`}>
            {i > 0 && <Connector color={n.color} delay={i * 0.3} reduceMotion={Boolean(reduceMotion)} />}
            <NodeCard node={n} index={i} reduceMotion={Boolean(reduceMotion)} />
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function NodeCard({
  node,
  index,
  reduceMotion,
}: {
  node: FlowNodeItem;
  index: number;
  reduceMotion: boolean;
}) {
  return (
    <motion.div
      initial={reduceMotion ? undefined : { opacity: 0, y: 10 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.4, delay: 0.15 + index * 0.15 }}
      whileHover={reduceMotion ? undefined : { y: -2 }}
      className="w-[118px] shrink-0 rounded-xl border border-border bg-surface-2/80 p-3 transition-colors hover:border-border-strong hover:bg-surface-3/70 sm:w-[136px] lg:w-[110px] lg:px-2.5 xl:w-[136px] xl:px-3"
    >
      <div className="flex items-center gap-2">
        <span
          className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
          style={{ background: `${node.color}1f`, color: node.color, boxShadow: `inset 0 0 0 1px ${node.color}40` }}
        >
          <Icon name={node.icon} className="h-3.5 w-3.5" />
        </span>
        <span className="dot dot-live ml-auto scale-75 bg-success" aria-label="ready" />
      </div>
      <div className="mt-2.5 truncate text-xs font-semibold">{node.label}</div>
      <div className="truncate text-[10px] text-fg-subtle">{node.sub}</div>
    </motion.div>
  );
}

function Connector({ color, delay, reduceMotion }: { color: string; delay: number; reduceMotion: boolean }) {
  return (
    <div className="relative mx-1 h-px w-8 shrink-0 sm:mx-1.5 sm:w-10 lg:mx-0 lg:w-auto lg:min-w-5 lg:flex-1">
      <div
        className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2"
        style={{ background: `linear-gradient(90deg, transparent, ${color}66, transparent)` }}
      />
      {!reduceMotion && (
        <span
          className="nl-particle absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px 1px ${color}aa`, animationDelay: `${delay}s`, animationDuration: "2.4s" }}
        />
      )}
    </div>
  );
}