"use client";

import { useRef, type CSSProperties } from "react";
import { motion, useInView } from "framer-motion";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { Icon } from "@/components/ui/icon";

type Capability = {
  icon: string;
  accent: string;
  headline: { kind: "count"; value: number; suffix: string } | { kind: "text"; value: string };
  label: string;
  desc: string;
};

const CAPABILITIES: Capability[] = [
  {
    icon: "Blocks",
    accent: "#7c5cff",
    headline: { kind: "count", value: 60, suffix: "+" },
    label: "Workflow Nodes",
    desc: "Visual AI, Logic, Memory, MCP and Integration nodes.",
  },
  {
    icon: "Plug",
    accent: "#22d3ee",
    headline: { kind: "count", value: 200, suffix: "+" },
    label: "Integrations",
    desc: "Connect Gmail, Slack, GitHub, Notion, APIs and more.",
  },
  {
    icon: "BrainCircuit",
    accent: "#5b8bff",
    headline: { kind: "text", value: "Persistent" },
    label: "Memory Engine",
    desc: "Long-term semantic memory, RAG and context retrieval.",
  },
  {
    icon: "Network",
    accent: "#34d399",
    headline: { kind: "text", value: "Multi-Agent" },
    label: "Runtime",
    desc: "Planner, Research, Reasoning, Reviewer & Executor.",
  },
];

const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.12, delayChildren: 0.05 } },
};
const cardV = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: "easeOut" as const } },
};
const iconV = {
  hidden: { opacity: 0, scale: 0.6 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: "easeOut" as const, delay: 0.18 } },
};

export function Metrics() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <motion.div
      ref={ref}
      variants={container}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: "-80px" }}
      className="grid grid-cols-2 gap-6 md:grid-cols-4"
    >
      {CAPABILITIES.map((c) => {
        const style = { "--glow": c.accent } as CSSProperties;
        return (
          <motion.div
            key={c.label}
            variants={cardV}
            style={style}
            className="metric-card h-full p-6 flex flex-col"
          >
            <motion.div
              variants={iconV}
              className="metric-icon grid h-11 w-11 place-items-center rounded-xl"
              style={{
                background: `${c.accent}1a`,
                color: c.accent,
                boxShadow: `inset 0 0 0 1px ${c.accent}33`,
              }}
            >
              <Icon name={c.icon} className="h-5 w-5" />
            </motion.div>

            <div className="metric-value mt-5 text-3xl font-semibold tracking-tight text-fg">
              {c.headline.kind === "count" ? (
                <AnimatedCounter
                  value={inView ? c.headline.value : 0}
                  suffix={c.headline.suffix}
                  duration={900}
                />
              ) : (
                c.headline.value
              )}
            </div>

            <div className="mt-1.5 text-sm font-medium text-fg">{c.label}</div>

            <div className="metric-divider my-3 h-px w-full bg-gradient-to-r from-brand/70 to-transparent" />

            <p className="text-xs leading-relaxed text-fg-muted">{c.desc}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}