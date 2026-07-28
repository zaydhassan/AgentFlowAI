"use client";

// NotificationsSettings — the Settings → Notifications panel.
// Loads the user's real preferences from /api/notifications/preferences, edits
// them in-place, and saves on submit. Category opt-ins, frequency, quiet hours,
// and timezone — all real, all persisted. No mock data.

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PREFERENCES,
  FREQUENCIES,
  PREFERENCE_TOGGLES,
  getPreferencesApi,
  savePreferencesApi,
  type NotificationPreferences,
} from "@/lib/notifications/client";

const TIMEZONES = [
  "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York",
  "America/Sao_Paulo", "Europe/London", "Europe/Paris", "Europe/Berlin",
  "Africa/Cairo", "Asia/Dubai", "Asia/Karachi", "Asia/Kolkata",
  "Asia/Bangkok", "Asia/Shanghai", "Asia/Tokyo", "Australia/Sydney",
  "UTC",
];

export function NotificationsSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    getPreferencesApi()
      .then((p) => { if (alive) setPrefs({ ...DEFAULT_PREFERENCES, ...p }); })
      .catch((e) => { if (alive) setError(e instanceof Error ? e.message : "Failed to load"); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const toggle = (flag: keyof NotificationPreferences) => {
    setPrefs((p) => ({ ...p, [flag]: !p[flag] } as NotificationPreferences));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await savePreferencesApi(prefs);
      setPrefs({ ...DEFAULT_PREFERENCES, ...next });
      setSavedAt(true);
      setTimeout(() => setSavedAt(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Card className="p-5"><div className="text-sm text-fg-subtle">Loading notification settings…</div></Card>;
  }

  return (
    <div className="space-y-6">
      {/* Channels */}
      <Card className="p-5">
        <CardHeader className="p-0">
          <CardTitle>Email notifications</CardTitle>
          <CardDescription>Choose which events send you an email. Your in-app feed always stays on.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4 space-y-1">
          {PREFERENCE_TOGGLES.map((t) => (
            <ToggleRow
              key={t.flag}
              label={t.label}
              hint={t.hint}
              checked={prefs[t.flag] as boolean}
              onChange={() => toggle(t.flag)}
            />
          ))}
        </CardContent>
      </Card>

      {/* Frequency */}
      <Card className="p-5">
        <CardHeader className="p-0">
          <CardTitle>Frequency</CardTitle>
          <CardDescription>How often non-critical notifications are delivered to your inbox.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {FREQUENCIES.map((f) => (
            <button
              key={f.value}
              onClick={() => setPrefs((p) => ({ ...p, frequency: f.value }))}
              className={cn(
                "rounded-xl border p-3 text-left transition-colors",
                prefs.frequency === f.value ? "border-brand bg-brand-soft/40" : "border-border hover:border-border-strong hover:bg-surface-2/50",
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{f.label}</span>
                {prefs.frequency === f.value && <Icon name="Check" className="h-3.5 w-3.5 text-brand" />}
              </div>
              <div className="mt-1 text-[11px] text-fg-subtle">{f.hint}</div>
            </button>
          ))}
        </CardContent>
      </Card>

      {/* Quiet hours + timezone */}
      <Card className="p-5">
        <CardHeader className="p-0">
          <CardTitle>Quiet hours</CardTitle>
          <CardDescription>Hold emails outside these hours (in your timezone). Leave blank to disable.</CardDescription>
        </CardHeader>
        <CardContent className="p-0 mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">Start</span>
              <Input
                type="time"
                value={prefs.quietHoursStart ?? ""}
                onChange={(e) => setPrefs((p) => ({ ...p, quietHoursStart: e.target.value || null }))}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-fg-muted">End</span>
              <Input
                type="time"
                value={prefs.quietHoursEnd ?? ""}
                onChange={(e) => setPrefs((p) => ({ ...p, quietHoursEnd: e.target.value || null }))}
              />
            </label>
          </div>
          <label className="block">
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
        </CardContent>
      </Card>

      {/* Save bar */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {error && <Badge tone="danger">{error}</Badge>}
          {savedAt && <Badge tone="success"><Icon name="Check" className="h-3 w-3" /> Saved</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setPrefs(DEFAULT_PREFERENCES)} disabled={saving}>
            Reset to defaults
          </Button>
          <Button size="sm" onClick={save} disabled={saving}>
            <Icon name={saving ? "LoaderCircle" : "Save"} className={cn("h-3.5 w-3.5", saving && "animate-spin")} />
            Save changes
          </Button>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({ label, hint, checked, onChange }: { label: string; hint: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      className="flex w-full items-center justify-between rounded-lg border border-border bg-surface-2/40 p-3 text-left transition-colors hover:bg-surface-2/70"
    >
      <div className="min-w-0">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-fg-subtle">{hint}</div>
      </div>
      <span
        className={cn(
          "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-brand" : "bg-surface-3",
        )}
      >
        <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform", checked ? "translate-x-4" : "translate-x-0.5")} />
      </span>
    </button>
  );
}