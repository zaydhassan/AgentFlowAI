"use client";

import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

const grid = "rgba(255,255,255,0.06)";
const axisTick = { fill: "#6b7185", fontSize: 11 };

// A datum point rendered by any of the dashboard charts. Fields are optional so
// the various payload shapes (trend points, donut slices) all assign cleanly.
interface ChartDatum {
  date?: string;
  success?: number;
  failures?: number;
  cost?: number;
  tokens?: number;
  name?: string;
  value?: number;
  color?: string;
}

function TooltipBox({
  active,
  payload,
  label,
  unit = "",
}: TooltipContentProps & { unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface-2/95 backdrop-blur-xl px-3 py-2 shadow-xl">
      {label != null && <div className="mb-1 text-[11px] text-fg-subtle">{String(label)}</div>}
      {payload.map((p) => {
        const color = p.color || (p.payload as { color?: string } | undefined)?.color;
        return (
          <div key={String(p.dataKey ?? p.name)} className="flex items-center gap-2 text-xs">
            <span className="h-2 w-2 rounded-full" style={{ background: color }} />
            <span className="text-fg-muted">{p.name}:</span>
            <span className="font-medium text-fg">
              {typeof p.value === "number" ? p.value.toLocaleString("en-US") : String(p.value)}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function ExecutionsAreaChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <defs>
          <linearGradient id="gExec" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#7c5cff" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#7c5cff" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gFail" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fb7185" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#fb7185" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={(p) => <TooltipBox {...p} />} />
        <Area type="monotone" dataKey="success" name="Success" stroke="#7c5cff" strokeWidth={2} fill="url(#gExec)" isAnimationActive animationDuration={900} animationEasing="ease-out" activeDot={{ r: 3, strokeWidth: 0 }} />
        <Area type="monotone" dataKey="failures" name="Failures" stroke="#fb7185" strokeWidth={2} fill="url(#gFail)" isAnimationActive animationDuration={900} animationEasing="ease-out" activeDot={{ r: 3, strokeWidth: 0 }} />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CostBarChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={(p) => <TooltipBox {...p} unit="$" />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
        <Bar dataKey="cost" name="Cost" radius={[4, 4, 0, 0]} fill="#22d3ee" isAnimationActive animationDuration={900} animationEasing="ease-out" />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function TokenLineChart({ data }: { data: ChartDatum[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="date" tick={axisTick} axisLine={false} tickLine={false} interval={1} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={48} />
        <Tooltip content={(p) => <TooltipBox {...p} />} />
        <Line type="monotone" dataKey="tokens" name="Tokens" stroke="#34d399" strokeWidth={2} dot={false} activeDot={{ r: 4, strokeWidth: 0 }} isAnimationActive animationDuration={900} animationEasing="ease-out" />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({ data, unit = "" }: { data: ChartDatum[]; unit?: string }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          innerRadius="62%"
          outerRadius="92%"
          paddingAngle={3}
          stroke="none"
          isAnimationActive
          animationDuration={900}
          animationEasing="ease-out"
        >
          {data.map((d, i) => (
            <Cell key={i} fill={d.color} />
          ))}
        </Pie>
        <Tooltip content={(p) => <TooltipBox {...p} unit={unit} />} />
      </PieChart>
    </ResponsiveContainer>
  );
}