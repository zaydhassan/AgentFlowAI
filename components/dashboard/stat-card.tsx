"use client";

import { Icon } from "@/components/ui/icon";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { EmptyState, type EmptyStateSpec } from "@/components/dashboard/empty-state";
import { cn } from "@/lib/utils";

export interface StatSubrow {
  label: string;
  value: string;
}

interface StatCardProps {
  label: string;
  value: number;
  icon: string;
  format?: (n: number) => string;
  prefix?: string;
  suffix?: string;
  delta?: number; // percentage
  accent?: string; // hex
  spark?: number[];
  /** Supporting info rendered under the metric (e.g. Today / Last 7 days). */
  subrows?: StatSubrow[];
  /** When set, the card renders an empty state instead of a metric. */
  empty?: EmptyStateSpec;
}

export function StatCard({
  label,
  value,
  icon,
  format,
  prefix,
  suffix,
  delta,
  accent = "#7c5cff",
  spark,
  subrows,
  empty,
}: StatCardProps) {
  // Empty state: same tile footprint, but a quiet prompt + CTA instead of a 0.
  if (empty) {
    return (
      <div className="card-hover relative overflow-hidden rounded-xl border border-border bg-surface p-4">
        <EmptyState compact {...empty} />
      </div>
    );
  }

  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card-hover group relative overflow-hidden rounded-xl border border-border bg-surface p-4 transition-colors hover:border-border-strong">
      <div className="flex items-start justify-between">
        <div
          className="grid h-9 w-9 place-items-center rounded-lg border border-border transition-colors group-hover:border-border-strong"
          style={{ color: accent }}
        >
          <Icon name={icon} className="h-4 w-4" />
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
            )}
          >
            <Icon name={positive ? "TrendingUp" : "TrendingDown"} className="h-3 w-3" />
            {Math.abs(delta)}%
          </div>
        )}
      </div>
      <div className="mt-3 text-2xl font-semibold tracking-tight">
        <AnimatedCounter value={value} format={format} prefix={prefix} suffix={suffix} />
      </div>
      <div className="mt-0.5 text-xs text-fg-muted">{label}</div>

      {subrows && subrows.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-2">
          {subrows.map((r) => (
            <div key={r.label} className="flex items-center gap-1 text-[10px]">
              <span className="text-fg-subtle">{r.label}</span>
              <span className="font-medium text-fg-muted tabular-nums">{r.value}</span>
            </div>
          ))}
        </div>
      )}

      {spark && spark.length > 1 && <Sparkline data={spark} color={accent} />}
    </div>
  );
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * w;
    const y = h - ((d - min) / range) * h;
    return `${x},${y}`;
  });
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-2 h-7 w-full" preserveAspectRatio="none">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={pts.join(" ")}
        opacity={0.8}
      />
    </svg>
  );
}