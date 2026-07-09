"use client";

import { Icon } from "@/components/ui/icon";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { cn } from "@/lib/utils";

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
}: StatCardProps) {
  const positive = (delta ?? 0) >= 0;
  return (
    <div className="card-hover glass relative overflow-hidden rounded-xl p-4">
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full opacity-20 blur-2xl"
        style={{ background: accent }}
      />
      <div className="flex items-start justify-between">
        <div className="grid h-9 w-9 place-items-center rounded-lg border border-border" style={{ color: accent }}>
          <Icon name={icon} className="h-4 w-4" />
        </div>
        {delta !== undefined && (
          <div
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium",
              positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
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
      {spark && <Sparkline data={spark} color={accent} />}
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