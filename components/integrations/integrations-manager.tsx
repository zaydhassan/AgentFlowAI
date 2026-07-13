"use client";

// Integrations manager: connect / disconnect / reconnect / test connected
// accounts. Provider-agnostic — iterates the providers list, so adding
// Slack/Notion later just works (each provider Card + its accounts render the
// same way). All token handling stays server-side; this component only ever
// sees the client-safe IntegrationAccount shape.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { toast } from "@/components/ui/toast";
import {
  connectProvider,
  disconnectAccount,
  reconnectAccount,
  refreshAccount,
  type IntegrationAccount,
  type IntegrationProviderInfo,
} from "@/lib/integrations/client";

type Provider = IntegrationProviderInfo & { connectedCount: number };

interface Props {
  providers: Provider[];
  accounts: IntegrationAccount[];
  encryptionConfigured: boolean;
  flash: { kind: "connected" } | { kind: "error"; message: string } | null;
}

const statusTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  expired: "warning",
  revoked: "danger",
  error: "danger",
};

function shortScope(scope: string): string {
  return scope.replace("https://www.googleapis.com/auth/", "").replace("https://www.googleapis.com/", "");
}

function when(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export function IntegrationsManager({ providers, accounts: initialAccounts, encryptionConfigured, flash }: Props) {
  const [accounts, setAccounts] = useState(initialAccounts);

  useEffect(() => {
    if (!flash) return;
    if (flash.kind === "connected") toast.success("Gmail account connected.");
    else toast.error(flash.message);
  }, [flash]);

  const handleConnect = async (provider: string) => {
    try {
      await connectProvider(provider as never);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start connect.");
    }
  };

  const handleReconnect = async (accountId: string) => {
    try {
      await reconnectAccount(accountId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not start reconnect.");
    }
  };

  const handleDisconnect = async (accountId: string) => {
    try {
      await disconnectAccount(accountId);
      setAccounts((arr) => arr.filter((a) => a.id !== accountId));
      toast.success("Account disconnected.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not disconnect.");
    }
  };

  const handleTest = async (accountId: string) => {
    try {
      await refreshAccount(accountId);
      setAccounts((arr) => arr.map((a) => (a.id === accountId ? { ...a, status: "active" } : a)));
      toast.success("Connection OK — token refreshed.");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Connection test failed.";
      setAccounts((arr) => arr.map((a) => (a.id === accountId ? { ...a, status: "revoked" } : a)));
      toast.error(msg);
    }
  };

  return (
    <div className="space-y-5">
      {!encryptionConfigured && (
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="flex items-start gap-2 p-3">
            <Icon name="TriangleAlert" className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div className="text-xs text-fg-muted">
              <span className="font-medium text-warning">Token encryption is not configured.</span>{" "}
              Set <code className="rounded bg-surface-3 px-1">INTEGRATIONS_ENCRYPTION_KEY</code> in
              <code className="ml-1 rounded bg-surface-3 px-1">.env</code> (run{" "}
              <code className="rounded bg-surface-3 px-1">openssl rand -base64 32</code>) before connecting accounts —
              otherwise connect will return a 503.
            </div>
          </CardContent>
        </Card>
      )}

      {providers.map((p) => {
        const providerAccounts = accounts.filter((a) => a.provider === p.id);
        return (
          <Card key={p.id}>
            <CardHeader className="flex flex-row items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-lg" style={{ background: `${p.color}22`, color: p.color }}>
                  <Icon name={p.icon} className="h-5 w-5" />
                </span>
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {p.label}
                    {p.configured ? (
                      <Badge tone="success">configured</Badge>
                    ) : (
                      <Badge tone="warning">not configured</Badge>
                    )}
                    <span className="text-[11px] font-normal text-fg-subtle">{p.connectedCount} connected</span>
                  </CardTitle>
                  <CardDescription>{p.description}</CardDescription>
                </div>
              </div>
              <Button
                size="sm"
                variant={p.configured ? "primary" : "secondary"}
                disabled={!p.configured}
                onClick={() => handleConnect(p.id)}
                title={p.configured ? `Connect a ${p.label} account` : `Set ${p.label} credentials in .env first`}
              >
                <Icon name="Plus" className="h-3.5 w-3.5" /> Connect
              </Button>
            </CardHeader>

            <CardContent className="space-y-2">
              {providerAccounts.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-fg-subtle">
                  No {p.label} accounts connected yet.
                </div>
              ) : (
                providerAccounts.map((a) => (
                  <div key={a.id} className="flex flex-col gap-3 rounded-lg border border-border bg-surface-2/40 p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-sm font-medium">{a.email ?? a.label}</span>
                        <Badge tone={statusTone[a.status] ?? "neutral"}>{a.status}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-1 text-[10px] text-fg-subtle">
                        <span>Connected {when(a.connectedAt)}</span>
                        {a.scopes.map((s) => (
                          <span key={s} className="rounded border border-border bg-surface-3 px-1.5 py-0.5 font-mono">
                            {shortScope(s)}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Button size="sm" variant="ghost" onClick={() => handleTest(a.id)} title="Refresh the token / verify the connection">
                        <Icon name="RefreshCw" className="h-3.5 w-3.5" /> Test
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleReconnect(a.id)} title="Re-grant consent (fixes revoked access)">
                        <Icon name="RefreshCcw" className="h-3.5 w-3.5" /> Reconnect
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleDisconnect(a.id)}>
                        <Icon name="Trash2" className="h-3.5 w-3.5" /> Disconnect
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        );
      })}

      <p className="text-[11px] text-fg-subtle">
        Tokens are AES-256-GCM encrypted at rest and never exposed to the browser. Disconnect revokes access at the
        provider and deletes the local row.
      </p>
    </div>
  );
}