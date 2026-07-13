"use client";

import { memo } from "react";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import { cn } from "@/lib/utils";

// Animated gradient edge. When `animated` (running), the stroke flows brand→ai;
// otherwise it takes a status tint so success/failed runs read at a glance.
function CustomEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  animated,
  selected,
}: EdgeProps) {
  const status = (data as { status?: string } | undefined)?.status;
  const stroke = animated
    ? "url(#agentflow-edge-running)"
    : status === "failed"
      ? "#fb7185"
      : status === "succeeded"
        ? "#34d399"
        : "#5b6178";

  const [path, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  return (
    <>
      <defs>
        <linearGradient id="agentflow-edge-running" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7c5cff" />
          <stop offset="50%" stopColor="#22d3ee" />
          <stop offset="100%" stopColor="#7c5cff" />
        </linearGradient>
      </defs>
      <BaseEdge id={id} path={path} style={{ stroke, strokeWidth: selected ? 2.5 : 2 }} />
      {animated && (
        <EdgeLabelRenderer>
          <div
            className={cn("pointer-events-none absolute h-1.5 w-1.5 rounded-full bg-brand shadow-[0_0_8px_2px_rgba(124,92,255,0.6)]")}
            style={{ left: labelX - 3, top: labelY - 3 }}
          />
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const CustomEdge = memo(CustomEdgeComponent);