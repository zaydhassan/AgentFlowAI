"use client";

import { useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { NotificationsSettings } from "@/components/notifications/notifications-settings";
import { ProfileSettings } from "@/components/settings/profile-settings";

const tabs = [
  { id: "profile", label: "Profile", icon: "User" },
  { id: "general", label: "General", icon: "Settings" },
  { id: "team", label: "Team & RBAC", icon: "Users" },
  { id: "keys", label: "API Keys", icon: "KeyRound" },
  { id: "secrets", label: "Secrets", icon: "Lock" },
  { id: "env", label: "Environment", icon: "Terminal" },
  { id: "notifications", label: "Notifications", icon: "Bell" },
  { id: "audit", label: "Audit Log", icon: "ShieldCheck" },
] as const;

export default function SettingsPage() {
  const [tab, setTab] = useState<(typeof tabs)[number]["id"]>("profile");

  return (
    <div className="animate-float-up">
      <PageHeader title="Settings" description="Manage your profile, workspace, and preferences" />

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
          {tab === "profile" && <ProfileSettings />}

          {tab === "general" && (
            <Card className="p-5">
              <CardHeader className="p-0"><CardTitle>General</CardTitle><CardDescription>Workspace identity & defaults</CardDescription></CardHeader>
              <CardContent className="p-0 mt-4 space-y-4">
                <Field label="Workspace name" placeholder="Your workspace name" />
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Plan" placeholder="—" />
                  <Field label="Seats" placeholder="—" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Region" placeholder="—" />
                  <Field label="SSO" placeholder="Not configured" />
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
                <div><CardTitle>Team & RBAC</CardTitle><CardDescription>Invite teammates and manage roles</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="UserPlus" className="h-3.5 w-3.5" /> Invite member</Button>
              </CardHeader>
              <CardContent className="space-y-3">
                <EmptyState
                  icon="Users"
                  title="No team members yet"
                  description="Invite teammates to collaborate on workflows, secrets, and executions."
                  action={<Button size="sm" variant="ai"><Icon name="UserPlus" className="h-3.5 w-3.5" /> Invite member</Button>}
                />
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
              <CardContent>
                <EmptyState
                  icon="KeyRound"
                  title="No API keys yet"
                  description="Create a key to access the AgentFlow API from scripts and services."
                  action={<Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Create key</Button>}
                />
              </CardContent>
            </Card>
          )}

          {tab === "secrets" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Secrets Manager</CardTitle><CardDescription>Encrypted, rotatable credentials</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add secret</Button>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon="Lock"
                  title="No secrets yet"
                  description="Store API tokens and credentials encrypted at rest, scoped to your org or a single workflow."
                  action={<Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add secret</Button>}
                />
              </CardContent>
            </Card>
          )}

          {tab === "env" && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div><CardTitle>Environment Variables</CardTitle><CardDescription>Per-environment configuration</CardDescription></div>
                <Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add variable</Button>
              </CardHeader>
              <CardContent>
                <EmptyState
                  icon="Terminal"
                  title="No environment variables yet"
                  description="Add per-environment config (production / staging) for your workflows."
                  action={<Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Add variable</Button>}
                />
              </CardContent>
            </Card>
          )}

          {tab === "notifications" && (
            <NotificationsSettings />
          )}

          {tab === "audit" && (
            <Card>
              <CardHeader><CardTitle>Audit Log</CardTitle><CardDescription>Immutable record of all workspace activity</CardDescription></CardHeader>
              <CardContent>
                <EmptyState
                  icon="ShieldCheck"
                  title="No audit events yet"
                  description="Sign-ins, workflow publishes, secret rotations, and role changes will appear here as they happen."
                />
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ label, placeholder }: { label: string; placeholder?: string }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-fg-muted">{label}</span>
      <Input placeholder={placeholder} />
    </label>
  );
}