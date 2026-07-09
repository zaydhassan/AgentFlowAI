"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { teamMembers, auditLogs, orgInfo } from "@/lib/mock/data";
import { cn, relativeTime } from "@/lib/utils";

const tabs = [
  { id: "general", label: "General", icon: "Settings" },
  { id: "team", label: "Team & RBAC", icon: "Users" },
  { id: "keys", label: "API Keys", icon: "KeyRound" },
  { id: "secrets", label: "Secrets", icon: "Lock" },
  { id: "env", label: "Environment", icon: "Terminal" },
  { id: "audit", label: "Audit Log", icon: "ShieldCheck" },
] as const;

const roleTone = (r: string) => (r === "Owner" ? "brand" : r === "Admin" ? "ai" : r === "Editor" ? "info" : "neutral");

const apiKeys = [
  { id: "k1", name: "Production", key: "af_live_2f8a••••4c01", created: "12 days ago", lastUsed: "2m ago", scope: "read/write" },
  { id: "k2", name: "Staging", key: "af_test_91be••••7a22", created: "1 month ago", lastUsed: "1h ago", scope: "read/write" },
  { id: "k3", name: "Analytics (read)", key: "af_live_55de••••9f03", created: "3 months ago", lastUsed: "3d ago", scope: "read" },
];

const secrets = [
  { id: "sk1", name: "OPENAI_API_KEY", scope: "org", rotated: "4 days ago" },
  { id: "sk2", name: "ANTHROPIC_API_KEY", scope: "org", rotated: "1 week ago" },
  { id: "sk3", name: "SLACK_BOT_TOKEN", scope: "workflow", rotated: "2 days ago" },
  { id: "sk4", name: "POSTGRES_URL", scope: "org", rotated: "2 weeks ago" },
];

const envVars = [
  { name: "LOG_LEVEL", value: "info", scope: "production" },
  { name: "MAX_RETRIES", value: "3", scope: "production" },
  { name: "WEBHOOK_TIMEOUT_MS", value: "30000", scope: "production" },
  { name: "DEBUG_AGENT", value: "false", scope: "staging" },
];

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("general");

  return (
    <div className="animate-float-up">
      <PageHeader title="Settings" description={`Workspace · ${orgInfo.name}`} />

      <div className="flex flex-col gap-6 lg:flex-row">
        <div className="lg:w-56 shrink-0">
          <div className="flex gap-1 overflow-x-auto lg:flex-col">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm whitespace-nowrap transition-colors border",
                  tab === t.id ? "bg-brand-soft text-fg border-brand/30" : "border-transparent text-fg-muted hover:text-fg hover:bg-surface-2"
                )}
              >
                <Icon name={t.icon} className={cn("h-4 w-4", tab === t.id ? "text-brand" : "text-fg-subtle")} />
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          {tab === "general" && (
            <Card className="p-5">
              <CardHeader className="p-0"><CardTitle>General</CardTitle><CardDescription>Workspace identity & defaults</CardDescription></CardHeader>
              <CardContent className="p-0 mt-4 space-y-4">
                <Field label="Workspace name" value={orgInfo.name} />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Plan" value={orgInfo.plan} />
                  <Field label="Seats" value={`${orgInfo.seatsUsed} / ${orgInfo.seats}`} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Region" value={orgInfo.region} />
                  <Field label="SSO" value={orgInfo.sso ? "Enabled" : "Ready — not configured"} />
                </div>
                <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 p-3">
                  <div>
                    <div className="text-sm font-medium">Workspace isolation</div>
                    <div className="text-[11px] text-fg-subtle">Each workspace has isolated data, secrets, and quotas.</div>
                  </div>
                  <Badge tone="success">Enabled</Badge>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="secondary" size="sm">Cancel</Button>
                  <Button size="sm">Save changes</Button>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "team" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Team & RBAC</CardTitle><CardDescription>{orgInfo.seatsUsed} of {orgInfo.seats} seats used</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="UserPlus" className="h-3.5 w-3.5" /> Invite member</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {teamMembers.map((m) => (
                  <div key={m.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
                    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-brand to-ai text-xs font-semibold text-white">{m.avatar}</div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">{m.name}</div>
                      <div className="truncate text-[11px] text-fg-subtle">{m.email} · active {relativeTime(m.lastActive)}</div>
                    </div>
                    <Badge tone={roleTone(m.role) as any}>{m.role}</Badge>
                    <button className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"><Icon name="MoreHorizontal" className="h-4 w-4" /></button>
                  </div>
                ))}
                <div className="rounded-lg border border-border bg-surface-2/40 p-3 text-[11px] text-fg-muted">
                  <div className="mb-1 flex items-center gap-1.5 font-medium text-fg"><Icon name="Shield" className="h-3.5 w-3.5" /> Roles & permissions</div>
                  <span className="text-fg-subtle">Owner · Admin · Editor · Viewer — configurable per-workflow and per-secret scope.</span>
                </div>
              </CardContent>
            </Card>
          )}

          {tab === "keys" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>API Keys</CardTitle><CardDescription>Programmatic access to the AgentFlow API</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Create key</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {apiKeys.map((k) => (
                  <div key={k.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
                    <Icon name="KeyRound" className="h-4 w-4 text-fg-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{k.name}</span>
                        <span className="font-mono text-[11px] text-fg-subtle">{k.key}</span>
                      </div>
                      <div className="text-[11px] text-fg-subtle">created {k.created} · last used {k.lastUsed} · {k.scope}</div>
                    </div>
                    <button className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-danger"><Icon name="Trash2" className="h-4 w-4" /></button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "secrets" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Secrets Manager</CardTitle><CardDescription>Encrypted, rotatable credentials</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add secret</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {secrets.map((s) => (
                  <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
                    <Icon name="Lock" className="h-4 w-4 text-fg-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-sm">{s.name}</div>
                      <div className="text-[11px] text-fg-subtle">scope: {s.scope} · rotated {s.rotated}</div>
                    </div>
                    <button className="rounded-md border border-border px-2 py-1 text-[11px] text-fg-muted hover:text-fg hover:bg-surface-3"><Icon name="RotateCcw" className="mr-1 inline h-3 w-3" /> Rotate</button>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "env" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Environment Variables</CardTitle><CardDescription>Per-environment configuration</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add variable</Button>
              </CardHeader>
              <CardContent className="space-y-2">
                {envVars.map((v) => (
                  <div key={v.name} className="flex items-center gap-3 rounded-lg border border-border bg-bg/60 p-3 font-mono text-xs">
                    <span className="text-brand">{v.name}</span>
                    <span className="text-fg-subtle">=</span>
                    <span className="text-fg">{v.value}</span>
                    <Badge tone="neutral" className="ml-auto">{v.scope}</Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {tab === "audit" && (
            <Card>
              <CardHeader><CardTitle>Audit Log</CardTitle><CardDescription>Immutable record of all workspace activity</CardDescription></CardHeader>
              <CardContent className="space-y-1">
                {auditLogs.map((a) => (
                  <div key={a.id} className="flex items-start gap-3 rounded-lg px-2 py-2 hover:bg-surface-2/50">
                    <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-3 text-[10px] font-medium">
                      {a.actor === "system" ? <Icon name="Cpu" className="h-3.5 w-3.5" /> : a.actor.split(" ").map((p) => p[0]).join("").slice(0, 2)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs"><span className="font-medium">{a.actor}</span> <span className="text-fg-muted">{a.action}</span> <span className="text-fg">{a.target}</span></div>
                      <div className="text-[10px] text-fg-subtle">{relativeTime(a.timestamp)} · {a.ip}</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      <Input defaultValue={value} />
    </label>
  );
}