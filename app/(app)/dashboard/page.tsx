"use client";

import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { ExecutionsAreaChart, CostBarChart, TokenLineChart, DonutChart } from "@/components/dashboard/charts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import {
  dashboardStats,
  executionTrend,
  tokenBreakdown,
  costByCategory,
  recentActivity,
  workflows,
} from "@/lib/mock/data";
import { formatNumber, formatCurrency, relativeTime, cn } from "@/lib/utils";

const sparks = {
  executions: [12, 14, 13, 16, 15, 18, 17, 20, 19, 22, 24, 23, 26, 28],
  workflows: [30, 32, 33, 38, 40, 42, 44, 45, 46, 47, 47, 47, 47, 47],
  agents: [4, 5, 6, 8, 7, 9, 10, 11, 12, 11, 12, 12, 12, 12],
  api: [6.2, 6.8, 7.1, 7.6, 8.0, 8.4, 8.9, 9.2, 9.4, 9.6, 9.7, 9.8, 9.8, 9.82],
  credits: [220, 210, 200, 190, 180, 175, 168, 160, 155, 152, 148, 145, 143, 142.5],
  tokens: [620, 660, 690, 720, 740, 760, 780, 800, 810, 825, 832, 838, 840, 842],
};

export default function DashboardPage() {
  return (
    <div className="animate-float-up">
      <PageHeader
        title="Dashboard"
        description="Real-time overview of your AI automation workspace."
        actions={
          <>
            <Button variant="secondary" size="sm">
              <Icon name="Download" className="h-3.5 w-3.5" /> Export
            </Button>
            <Button size="sm">
              <Icon name="Plus" className="h-3.5 w-3.5" /> New Workflow
            </Button>
          </>
        }
      />

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Total Executions" value={dashboardStats.totalExecutions} icon="Activity" delta={12.4} accent="#7c5cff" format={formatNumber} spark={sparks.executions} />
        <StatCard label="Active Workflows" value={dashboardStats.activeWorkflows} icon="Workflow" delta={4.2} accent="#22d3ee" spark={sparks.workflows} />
        <StatCard label="Running Agents" value={dashboardStats.runningAgents} icon="Bot" delta={8.0} accent="#34d399" spark={sparks.agents} />
        <StatCard label="API Calls" value={dashboardStats.apiUsage} icon="Globe" delta={6.1} accent="#f59e0b" format={formatNumber} spark={sparks.api.map((v) => v * 1000)} />
        <StatCard label="Credits Left" value={dashboardStats.creditsRemaining} icon="Coins" delta={-3.2} accent="#fb7185" format={formatNumber} spark={sparks.credits} />
        <StatCard label="Tokens (M)" value={842} icon="Cpu" suffix="M" delta={9.8} accent="#a855f7" spark={sparks.tokens} />
      </div>

      {/* Charts row */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Execution Volume</CardTitle>
              <CardDescription>Last 14 days — successful vs failed runs</CardDescription>
            </div>
            <Badge tone="success">98.2% success</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ExecutionsAreaChart data={executionTrend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Usage by Provider</CardTitle>
            <CardDescription>842M tokens this month</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-44">
              <DonutChart data={tokenBreakdown} />
              <div className="pointer-events-none absolute inset-0 grid place-items-center">
                <div className="text-center">
                  <div className="text-xl font-semibold">842M</div>
                  <div className="text-[10px] text-fg-subtle">tokens</div>
                </div>
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              {tokenBreakdown.map((t) => (
                <div key={t.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: t.color }} />
                  <span className="text-fg-muted">{t.name}</span>
                  <span className="ml-auto font-medium">{formatNumber(t.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second row */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Cost Analytics</CardTitle>
              <CardDescription>Daily spend (USD)</CardDescription>
            </div>
            <div className="text-right">
              <div className="text-lg font-semibold">{formatCurrency(dashboardStats.monthlyCost)}</div>
              <div className="text-[10px] text-fg-subtle">this month</div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <CostBarChart data={executionTrend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spend by Category</CardTitle>
            <CardDescription>Where your credits go</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative h-32">
              <DonutChart data={costByCategory} unit="$" />
            </div>
            <div className="mt-3 space-y-1.5">
              {costByCategory.map((c) => (
                <div key={c.name} className="flex items-center gap-2 text-xs">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c.color }} />
                  <span className="text-fg-muted">{c.name}</span>
                  <span className="ml-auto font-medium">{formatCurrency(c.value)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Third row: tokens trend + workflow health + recent activity */}
      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Token Usage Trend</CardTitle>
            <CardDescription>Daily tokens consumed across all providers</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-56">
              <TokenLineChart data={executionTrend} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workflow Health</CardTitle>
            <CardDescription>Top workflows by status</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {workflows.slice(0, 5).map((w) => (
              <div key={w.id} className="flex items-center gap-3">
                <span
                  className={cn(
                    "dot",
                    w.status === "active" && "bg-success dot-live",
                    w.status === "draft" && "bg-fg-subtle",
                    w.status === "paused" && "bg-warning",
                    w.status === "error" && "bg-danger dot-live"
                  )}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{w.name}</div>
                  <div className="text-[10px] text-fg-subtle">{relativeTime(w.lastRun)}</div>
                </div>
                <div className="w-20">
                  <div className="h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full",
                        w.health > 90 ? "bg-success" : w.health > 70 ? "bg-warning" : "bg-danger"
                      )}
                      style={{ width: `${w.health}%` }}
                    />
                  </div>
                </div>
                <span className="w-9 text-right text-xs font-medium tabular-nums">{w.health}%</span>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Recent activity + notifications */}
      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Recent Activity</CardTitle>
            <Button variant="ghost" size="sm">View all</Button>
          </CardHeader>
          <CardContent className="space-y-1">
            {recentActivity.map((a, i) => (
              <div
                key={a.id}
                className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/60 transition-colors"
                style={{ animation: `float-up 0.4s ease ${i * 40}ms both` }}
              >
                <span
                  className={cn(
                    "mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                    a.type === "success" && "bg-success/10 text-success",
                    a.type === "info" && "bg-info/10 text-info",
                    a.type === "warning" && "bg-warning/10 text-warning",
                    a.type === "error" && "bg-danger/10 text-danger"
                  )}
                >
                  <Icon name={a.icon} className="h-3.5 w-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm">{a.text}</div>
                  <div className="text-[11px] text-fg-subtle">{relativeTime(a.time)}</div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Status</CardTitle>
            <CardDescription>Live system health</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <StatusRow label="Execution engine" value="Operational" tone="success" />
            <StatusRow label="API gateway" value="Operational" tone="success" />
            <StatusRow label="Queue (Celery)" value="Operational" tone="success" />
            <StatusRow label="Memory store" value="Degraded" tone="warning" />
            <StatusRow label="Webhook ingress" value="Operational" tone="success" />
            <div className="mt-2 rounded-lg border border-border bg-surface-2/60 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-fg-muted">Error rate (24h)</span>
                <span className="font-medium text-warning">{dashboardStats.errorRate}%</span>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full w-[18%] rounded-full bg-gradient-to-r from-warning to-danger" />
                </div>
                <span className="text-[10px] text-fg-subtle">SLO 99.5%</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatusRow({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "danger" }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2">
      <span className="text-sm text-fg-muted">{label}</span>
      <span className="flex items-center gap-2 text-xs">
        <span className={cn("dot", tone === "success" && "bg-success", tone === "warning" && "bg-warning", tone === "danger" && "bg-danger")} />
        <span className="font-medium">{value}</span>
      </span>
    </div>
  );
}