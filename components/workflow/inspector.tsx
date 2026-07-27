"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getNodeDef, validateNodeConfig } from "@/lib/nodes";
import { cn, formatDuration } from "@/lib/utils";
import type { WorkflowNode, ConfigField, NodeStatus } from "@/lib/types";

interface ConnectedAccount {
  id: string;
  email: string | null;
  label: string;
  status: string;
}

const statusDot: Record<string, string> = {
  active: "bg-success",
  expired: "bg-warning",
  revoked: "bg-danger",
  error: "bg-danger",
};

export function Inspector({
  node,
  onUpdate,
  onRetry,
  onDelete,
  onToggleBreakpoint,
}: {
  node: WorkflowNode | null;
  onUpdate: (id: string, patch: Partial<WorkflowNode["data"]>) => void;
  onRetry: (id: string) => void;
  onDelete: (id: string) => void;
  onToggleBreakpoint: (id: string) => void;
}) {
  if (!node) {
    return (
      <div className="flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-xl bg-surface-2 text-fg-subtle">
          <Icon name="MousePointerClick" className="h-5 w-5" />
        </div>
        <div className="mt-3 text-sm font-medium">Select a node</div>
        <p className="mt-1 text-xs text-fg-muted">Click any node on the canvas to inspect its settings, logs, and execution details.</p>
      </div>
    );
  }

  const def = getNodeDef(node.type);
  const status: NodeStatus = node.data.status ?? "idle";
  const tone = status === "succeeded" ? "success" : status === "failed" ? "danger" : status === "running" ? "brand" : status === "retrying" ? "warning" : "neutral";
  const errors = def ? validateNodeConfig(node.type, node.data.config ?? {}) : [];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 border-b border-border p-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg" style={{ background: `${def?.color ?? "#64748b"}22`, color: def?.color ?? "#64748b" }}>
          <Icon name={def?.icon ?? "Circle"} className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <input
            value={node.data.label}
            onChange={(e) => onUpdate(node.id, { label: e.target.value })}
            className="w-full truncate rounded text-sm font-semibold bg-transparent focus:outline-none focus:ring-1 focus:ring-brand rounded px-1 -mx-1"
          />
          <div className="text-[10px] text-fg-subtle">{node.type}</div>
        </div>
        <Badge tone={tone as any}>{status}</Badge>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Execution metrics */}
        <Section icon="Activity" title="Execution">
          <Row label="Status" value={<span className="capitalize">{status}</span>} />
          <Row label="Duration" value={node.data.durationMs !== undefined ? formatDuration(node.data.durationMs) : "—"} />
          <Row label="Tokens" value={node.data.tokensUsed != null ? `${node.data.tokensUsed}` : "—"} />
          <Row label="Retries" value={`${node.data.retries ?? 0}`} />
          <Row label="Inputs / Outputs" value={`${def?.inputs ?? 0} / ${def?.outputs ?? 0}`} />
        </Section>

        {/* Settings — generated from configSchema */}
        {def?.configSchema && def.configSchema.length > 0 ? (
          <Section icon="Settings2" title="Configuration">
            <div className="space-y-2.5">
              {def.configSchema.map((field) => (
                <ConfigInput key={field.key} field={field} value={node.data.config?.[field.key]} onChange={(v) => onUpdate(node.id, { config: { ...node.data.config, [field.key]: v } })} />
              ))}
            </div>
            {errors.length > 0 && (
              <div className="mt-2 rounded-lg border border-danger/30 bg-danger/5 p-2 text-[11px] text-danger">
                <div className="flex items-center gap-1 font-medium"><Icon name="AlertCircle" className="h-3 w-3" /> Validation</div>
                <ul className="mt-1 space-y-0.5">
                  {errors.map((e, i) => <li key={i}>· {e}</li>)}
                </ul>
              </div>
            )}
          </Section>
        ) : (
          <Section icon="Settings2" title="Configuration">
            <p className="text-[11px] text-fg-subtle">This node has no configurable settings.</p>
          </Section>
        )}

        {/* Logs */}
        <Section icon="Terminal" title="Logs">
          {(!node.data.logs || node.data.logs.length === 0) ? (
            <p className="text-[11px] text-fg-subtle">No logs yet. Run the workflow to see live output.</p>
          ) : (
            <div className="rounded-lg border border-border bg-bg/60 p-2 font-mono text-[10px] leading-relaxed max-h-44 overflow-y-auto">
              {node.data.logs.map((log, i) => (
                <div key={i} className={cn("py-0.5", i === node.data.logs!.length - 1 && status === "running" && "text-brand")}>
                  <span className="text-fg-subtle">{String(i + 1).padStart(2, "0")} </span>
                  <span className="text-fg-muted">{log}</span>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="space-y-2 border-t border-border p-3">
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" size="sm" onClick={() => onToggleBreakpoint(node.id)} className={cn(node.data.breakpoint && "border-danger/40 text-danger")}>
            <Icon name="CircleDot" className="h-3.5 w-3.5" /> {node.data.breakpoint ? "Breakpoint on" : "Breakpoint"}
          </Button>
          <Button variant="secondary" size="sm" onClick={() => onRetry(node.id)} disabled={status === "idle"}>
            <Icon name="RotateCcw" className="h-3.5 w-3.5" /> Retry
          </Button>
        </div>
        <Button variant="danger" size="sm" className="w-full" onClick={() => onDelete(node.id)}>
          <Icon name="Trash2" className="h-3.5 w-3.5" /> Delete node
        </Button>
      </div>
    </div>
  );
}

function ConfigInput({ field, value, onChange }: { field: ConfigField; value: unknown; onChange: (v: unknown) => void }) {
  const base = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring";
  const codeBase = "w-full rounded-lg border border-border bg-surface-2 px-2.5 py-1.5 text-xs font-mono text-fg focus-ring min-h-[64px]";

  return (
    <label className="block">
      <span className="mb-1 flex items-center gap-1 text-[11px] text-fg-muted">
        {field.label}
        {field.required && <span className="text-danger">*</span>}
      </span>
      {field.type === "account" ? (
        <AccountSelect field={field} value={value} onChange={onChange} />
      ) : field.type === "mcp.tool" ? (
        <McpToolSelect field={field} value={value} onChange={onChange} />
      ) : field.type === "mcp.resource" ? (
        <McpResourceSelect field={field} value={value} onChange={onChange} />
      ) : field.type === "select" ? (
        <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={base}>
          <option value="">—</option>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      ) : field.type === "boolean" ? (
        <button
          type="button"
          onClick={() => onChange(!value)}
          className={cn("flex h-8 w-12 items-center rounded-full border px-0.5 transition-colors", value ? "bg-brand border-brand justify-end" : "bg-surface-3 border-border justify-start")}
        >
          <span className="h-6 w-6 rounded-full bg-white shadow" />
        </button>
      ) : field.type === "textarea" ? (
        <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={3} placeholder={field.placeholder} className={cn(base, "h-auto min-h-[64px] py-1.5")} />
      ) : field.type === "code" ? (
        <textarea value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} rows={4} placeholder={field.placeholder} className={codeBase} spellCheck={false} />
      ) : field.type === "secret" ? (
        <input type="password" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder ?? "••••••••"} className={base} />
      ) : field.type === "number" ? (
        <input type="number" value={value === undefined || value === null ? "" : Number(value)} onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} placeholder={field.placeholder} className={base} />
      ) : (
        <input type="text" value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} placeholder={field.placeholder} className={base} />
      )}
      {field.help && <span className="mt-1 block text-[10px] text-fg-subtle">{field.help}</span>}
    </label>
  );
}

function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
        <Icon name={icon} className="h-3 w-3" /> {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-2.5 py-1.5">
      <span className="text-[11px] text-fg-muted">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

// Connected-integration-account dropdown. Fetches /api/integrations/accounts
// for the field's provider and lists them; links to Settings → Integrations
// when none are connected. The selected value is the account id (stored in
// node config as `accountId`), which the execution engine resolves at run time.
function AccountSelect({ field, value, onChange }: { field: ConfigField; value: unknown; onChange: (v: unknown) => void }) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const provider = field.provider ?? "";
    let cancelled = false;
    setLoading(true);
    fetch(`/api/integrations/accounts?provider=${encodeURIComponent(provider)}`, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const data = (await r.json()) as { accounts: ConnectedAccount[] };
        if (!cancelled) setAccounts(data.accounts ?? []);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load accounts"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [field.provider]);

  const base = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring";

  if (loading) {
    return <div className={cn(base, "flex items-center text-fg-subtle")}>Loading accounts…</div>;
  }
  if (error) {
    return <div className={cn(base, "flex items-center text-danger")}>{error}</div>;
  }
  if (accounts.length === 0) {
    return (
      <div className="space-y-1">
        <div className={cn(base, "flex items-center text-fg-subtle")}>No accounts connected</div>
        <Link href="/settings/integrations" className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline">
          <Icon name="Plug" className="h-3 w-3" /> Connect {field.provider ?? "an account"} in Settings
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— Select account —</option>
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.email ?? a.label}
            {a.status !== "active" ? `  (${a.status})` : ""}
          </option>
        ))}
      </select>
      {value ? (() => {
        const a = accounts.find((x) => x.id === value);
        return a ? (
          <div className="flex items-center gap-1 text-[10px] text-fg-subtle">
            <span className={cn("dot h-2 w-2 rounded-full", statusDot[a.status] ?? "bg-fg-subtle")} />
            {a.status}
          </div>
        ) : null;
      })() : null}
    </div>
  );
}

// ─────────────────────────── MCP selectors ─────────────────────────────────
// Self-contained dropdowns mirroring AccountSelect. Each fetches the workspace's
// discovered MCP tools/resources (allow-list filtered server-side) and stores the
// composite id "<serverId>::<name>" in node config. No cascading; no sibling-
// config plumbing. Links to Settings → MCP when nothing is discovered yet.

interface McpDiscoveredItem {
  id: string; // "<serverId>::<name>"
  serverName: string;
  name: string;
  title: string | null;
  description: string | null;
  kind: "tool" | "resource" | "prompt";
  uri: string | null;
}

function useMcpDiscovered(endpoint: "/api/mcp/tools" | "/api/mcp/resources") {
  const [items, setItems] = useState<McpDiscoveredItem[]>([]);
  // `loading` starts true so the effect body never calls setState synchronously
  // (react-hooks/set-state-in-effect); only the async promise chain flips it.
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch(endpoint, { cache: "no-store" })
      .then(async (r) => {
        if (!r.ok) throw new Error(`Failed (${r.status})`);
        const data = (await r.json()) as { items: McpDiscoveredItem[] };
        if (!cancelled) setItems(data.items ?? []);
      })
      .catch((e) => !cancelled && setError(e instanceof Error ? e.message : "Could not load MCP items"))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [endpoint]);
  return { items, loading, error };
}

function McpSelectShell({
  loading,
  error,
  children,
}: {
  loading: boolean;
  error: string | null;
  children: React.ReactNode;
}) {
  const base = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring";
  if (loading) return <div className={cn(base, "flex items-center text-fg-subtle")}>Loading MCP items…</div>;
  if (error) return <div className={cn(base, "flex items-center text-danger")}>{error}</div>;
  return (
    <div className="space-y-1">
      {children}
      <Link href="/settings/integrations" className="inline-flex items-center gap-1 text-[10px] text-brand hover:underline">
        <Icon name="Plug" className="h-3 w-3" /> Manage integrations in Settings
      </Link>
    </div>
  );
}

function McpToolSelect({ value, onChange }: { field: ConfigField; value: unknown; onChange: (v: unknown) => void }) {
  const { items, loading, error } = useMcpDiscovered("/api/mcp/tools");
  const base = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring";
  if (loading || error) {
    return <McpSelectShell loading={loading} error={error}>{null}</McpSelectShell>;
  }
  if (items.length === 0) {
    return (
      <McpSelectShell loading={false} error={null}>
        <div className={cn(base, "flex items-center text-fg-subtle")}>No MCP tools discovered yet</div>
      </McpSelectShell>
    );
  }
  return (
    <McpSelectShell loading={false} error={null}>
      <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— Select tool —</option>
        {items.map((t) => (
          <option key={t.id} value={t.id}>
            {t.title ?? t.name} · {t.serverName}
          </option>
        ))}
      </select>
    </McpSelectShell>
  );
}

function McpResourceSelect({ value, onChange }: { field: ConfigField; value: unknown; onChange: (v: unknown) => void }) {
  const { items, loading, error } = useMcpDiscovered("/api/mcp/resources");
  const base = "h-8 w-full rounded-lg border border-border bg-surface-2 px-2.5 text-xs text-fg focus-ring";
  if (loading || error) {
    return <McpSelectShell loading={loading} error={error}>{null}</McpSelectShell>;
  }
  if (items.length === 0) {
    return (
      <McpSelectShell loading={false} error={null}>
        <div className={cn(base, "flex items-center text-fg-subtle")}>No MCP resources discovered yet</div>
      </McpSelectShell>
    );
  }
  return (
    <McpSelectShell loading={false} error={null}>
      <select value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} className={base}>
        <option value="">— Select resource —</option>
        {items.map((r) => (
          <option key={r.id} value={r.id}>
            {r.title ?? r.name} · {r.serverName}
          </option>
        ))}
      </select>
    </McpSelectShell>
  );
}