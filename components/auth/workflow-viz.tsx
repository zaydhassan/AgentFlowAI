"use client";

import { Fragment } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

// Ambient pipeline shown on the auth right panel. Pure decoration (aria-hidden):
// Gmail trigger -> AI Agent -> Memory -> MCP Tool -> Slack -> Database.
// Node cards stay static; a small particle travels each connector on a CSS
// keyframe so the motion survives any panel height. Reduced-motion users see
// the static pipeline with no particles.
const NODES = [
  { icon: "Mail", label: "Gmail Trigger", tint: "#22d3ee" },
  { icon: "Sparkles", label: "AI Agent", tint: "#7c5cff" },
  { icon: "Cpu", label: "Memory", tint: "#5b8bff" },
  { icon: "Wrench", label: "MCP Tool", tint: "#7c5cff" },
  { icon: "MessageSquare", label: "Slack", tint: "#22d3ee" },
  { icon: "Database", label: "Database", tint: "#5b8bff" },
] as const;

const CONNECTOR_HEIGHT = 20; // px — keep in sync with the `auth-flow` keyframe.

export function WorkflowViz({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div className={className} aria-hidden="true">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: "easeOut", delay: 0.25 }}
        className="w-44"
      >
        <ol className="flex flex-col items-stretch">
          {NODES.map((node, i) => (
            <Fragment key={node.label}>
              <motion.li
                initial={reduce ? false : { opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: "easeOut", delay: 0.3 + i * 0.08 }}
              >
                <div
                  className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/50 px-2.5 py-1.5 backdrop-blur-sm"
                  style={{ boxShadow: `0 0 24px -16px ${node.tint}` }}
                >
                  <span
                    className="grid h-6 w-6 shrink-0 place-items-center rounded-md"
                    style={{ background: `${node.tint}1f`, color: node.tint }}
                  >
                    <Icon name={node.icon} className="h-3.5 w-3.5" />
                  </span>
                  <span className="truncate text-[11px] font-medium text-fg-muted">{node.label}</span>
                </div>
              </motion.li>

              {i < NODES.length - 1 && (
                <li className="flex justify-center" style={{ height: CONNECTOR_HEIGHT }}>
                  <div className="relative w-px bg-gradient-to-b from-border to-border/40">
                    {!reduce && (
                      <span
                        className="auth-flow motion-reduce:hidden absolute left-1/2 top-0 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
                        style={{
                          background: node.tint,
                          boxShadow: `0 0 8px ${node.tint}`,
                          animationDelay: `${i * 0.35}s`,
                        }}
                      />
                    )}
                  </div>
                </li>
              )}
            </Fragment>
          ))}
        </ol>
      </motion.div>
    </div>
  );
}