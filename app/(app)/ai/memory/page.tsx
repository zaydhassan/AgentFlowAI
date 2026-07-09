"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

const memories = [
  { id: "m1", scope: "user", key: "preferred_currency", value: "EUR", source: "inferred from invoice history", ts: "2 days ago", hits: 184 },
  { id: "m2", scope: "org", key: "fiscal_year_start", value: "April 1", source: "set by owner", ts: "3 weeks ago", hits: 92 },
  { id: "m3", scope: "workflow", key: "invoice_processing.vendor_list", value: "12 vendors", source: "extracted", ts: "1 day ago", hits: 410 },
  { id: "m4", scope: "user", key: "report_format", value: "PDF, branded", source: "explicit", ts: "5 days ago", hits: 38 },
  { id: "m5", scope: "org", key: "support_escalation_policy", value: "any error > 5min → Slack #ops", source: "set by admin", ts: "1 week ago", hits: 14 },
  { id: "m6", scope: "workflow", key: "lead_gen.qualification_rules", value: "ICP: 50-500 employees, US, SaaS", source: "set by editor", ts: "4 days ago", hits: 220 },
];

const scopeTone = (s: string) => (s === "user" ? "brand" : s === "org" ? "ai" : "neutral");

export default function MemoryPage() {
  return (
    <div className="animate-float-up">
      <PageHeader
        title="Memory Agent"
        description="Long-term memory across runs, users, and business context — so workflows get smarter, not just faster."
        actions={<Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add memory</Button>}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4"><div className="flex items-center gap-2 text-fg-subtle"><Icon name="Brain" className="h-4 w-4 text-warning" /><span className="text-[11px] uppercase tracking-wider">Memories</span></div><div className="mt-2 text-2xl font-semibold">8,420</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-fg-subtle"><Icon name="Users" className="h-4 w-4 text-brand" /><span className="text-[11px] uppercase tracking-wider">Users</span></div><div className="mt-2 text-2xl font-semibold">12</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-fg-subtle"><Icon name="TrendingUp" className="h-4 w-4 text-success" /><span className="text-[11px] uppercase tracking-wider">Recall rate</span></div><div className="mt-2 text-2xl font-semibold">99.2%</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-fg-subtle"><Icon name="Database" className="h-4 w-4 text-ai" /><span className="text-[11px] uppercase tracking-wider">Store size</span></div><div className="mt-2 text-2xl font-semibold">2.4 GB</div></Card>
      </div>

      <Card className="mt-4">
        <CardHeader className="flex flex-row items-center justify-between">
          <div><CardTitle>Memory Store</CardTitle><CardDescription>What the agents remember</CardDescription></div>
          <div className="relative w-56"><Icon name="Search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" /><Input placeholder="Search memories…" className="pl-9" /></div>
        </CardHeader>
        <CardContent className="space-y-2">
          {memories.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
              <span className={cn("grid h-9 w-9 place-items-center rounded-lg", m.scope === "user" ? "bg-brand-soft text-brand" : m.scope === "org" ? "bg-ai/10 text-ai" : "bg-surface-3 text-fg-subtle")}>
                <Icon name={m.scope === "user" ? "User" : m.scope === "org" ? "Building2" : "Workflow"} className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs text-fg">{m.key}</span>
                  <Badge tone={scopeTone(m.scope) as any}>{m.scope}</Badge>
                </div>
                <div className="mt-0.5 truncate text-[11px] text-fg-muted"><span className="font-medium text-fg">{m.value}</span> · {m.source} · {m.ts}</div>
              </div>
              <div className="text-right">
                <div className="text-xs font-medium tabular-nums">{m.hits}</div>
                <div className="text-[10px] text-fg-subtle">recalls</div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}