"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { DEFAULT_PREFERENCES, FREQUENCIES, PREFERENCE_TOGGLES, type NotificationPreferences } from "@/lib/notifications/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Africa/Cairo", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney", "UTC",
];

function PreferencesForm({ token }: { token: string }) {
  const api = "/api/notifications/preferences";
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<"idle" | "saved" | "error">("idle");

  useEffect(() => {
    let alive = true;
    fetch(`${api}?token=${encodeURIComponent(token)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((p) => { if (alive) setPrefs({ ...DEFAULT_PREFERENCES, ...(p as NotificationPreferences) }); })
      .catch(() => { if (alive) setStatus("error"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [token]);

  const save = async () => {
    setSaving(true);
    setStatus("idle");
    try {
      const res = await fetch(`${api}?token=${encodeURIComponent(token)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(prefs),
      });
      if (!res.ok) throw new Error("save failed");
      const next = await res.json() as NotificationPreferences;
      setPrefs({ ...DEFAULT_PREFERENCES, ...next });
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 2500);
    } catch {
      setStatus("error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-sm text-fg-subtle">Loading your preferences…</div>;

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface-2/40 p-5">
        <h2 className="text-sm font-semibold">Email notifications</h2>
        <p className="mt-1 text-xs text-fg-subtle">Choose which events send you an email.</p>
        <div className="mt-4 space-y-1">
          {PREFERENCE_TOGGLES.map((t) => (
            <button
              key={t.flag}
              onClick={() => setPrefs((p) => ({ ...p, [t.flag]: !p[t.flag] } as NotificationPreferences))}
              className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2/40 p-3 text-left transition-colors hover:bg-surface-2/70"
            >
              <div>
                <div className="text-sm font-medium">{t.label}</div>
                <div className="text-[11px] text-fg-subtle">{t.hint}</div>
              </div>
              <span className={cn("relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors", prefs[t.flag] as boolean ? "bg-brand" : "bg-surface-3")}>
                <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", prefs[t.flag] as boolean ? "translate-x-4" : "translate-x-0.5")} />
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-2/40 p-5">
        <h2 className="text-sm font-semibold">Frequency</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setPrefs((p) => ({ ...p, frequency: f.value }))}
              className={cn("rounded-xl border p-3 text-left", prefs.frequency === f.value ? "border-brand bg-brand-soft/40" : "border-border hover:bg-surface-2/60")}
            >
              <div className="text-sm font-medium">{f.label}</div>
              <div className="mt-1 text-[11px] text-fg-subtle">{f.hint}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface-2/40 p-5">
        <h2 className="text-sm font-semibold">Quiet hours & timezone</h2>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fg-muted">Start</span>
            <Input type="time" value={prefs.quietHoursStart ?? ""} onChange={(e) => setPrefs((p) => ({ ...p, quietHoursStart: e.target.value || null }))} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-medium text-fg-muted">End</span>
            <Input type="time" value={prefs.quietHoursEnd ?? ""} onChange={(e) => setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value || null }))} />
          </label>
        </div>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-xs font-medium text-fg-muted">Timezone</span>
          <select
            value={prefs.timezone ?? ""}
            onChange={(e) => setPrefs((p) => ({ ...p, timezone: e.target.value || null }))}
            className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm text-fg focus:border-brand focus:outline-none"
          >
            <option value="">Auto (browser)</option>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz.replace(/_/g, " ")}</option>)}
          </select>
        </label>
      </section>

      <div className="flex items-center justify-between">
        {status === "saved" && <Badge tone="success"><Icon name="Check" className="h-3 w-3" /> Saved</Badge>}
        {status === "error" && <Badge tone="danger">Could not save — try again</Badge>}
        <Button onClick={save} disabled={saving} className="ml-auto">
          <Icon name={saving ? "LoaderCircle" : "Save"} className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
          Save preferences
        </Button>
      </div>
    </div>
  );
}

export default function PreferencesPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-bg" />}>
      <PreferencesPageInner />
    </Suspense>
  );
}

function PreferencesPageInner() {
  const sp = useSearchParams();
  const token = sp.get("token") ?? "";

  return (
    <div className="min-h-screen bg-bg text-fg">
      <div className="mx-auto max-w-2xl px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-ai">
            <Icon name="Bell" className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Notification preferences</h1>
            <p className="text-sm text-fg-muted">Manage what AgentFlow sends to your inbox.</p>
          </div>
        </div>
        {!token ? (
          <div className="rounded-2xl border border-border bg-surface-2/40 p-8 text-center">
            <Icon name="AlertCircle" className="mx-auto mb-3 h-6 w-6 text-warning" />
            <p className="text-sm">This link is invalid or has expired. Sign in to manage your notifications from Settings.</p>
          </div>
        ) : (
          <PreferencesForm token={token} />
        )}
      </div>
    </div>
  );
}