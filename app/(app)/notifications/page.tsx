"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { cn, relativeTime } from "@/lib/utils";
import {
  listNotificationsApi,
  markAllReadApi,
  markReadApi,
  type NotificationListQuery,
  type NotificationRecord,
  type NotificationSeverity,
  type NotificationCategory,
} from "@/lib/notifications/client";

const CATEGORIES: { value: NotificationCategory; label: string }[] = [
  { value: "workflow", label: "Workflow" },
  { value: "ai", label: "AI" },
  { value: "integration", label: "Integrations" },
  { value: "billing", label: "Billing" },
  { value: "security", label: "Security" },
  { value: "system", label: "System" },
];

const SEVERITIES: { value: NotificationSeverity; label: string }[] = [
  { value: "success", label: "Success" },
  { value: "info", label: "Info" },
  { value: "warning", label: "Warning" },
  { value: "error", label: "Error" },
];

const SEVERITY_ICON: Record<NotificationSeverity, string> = {
  success: "CheckCircle2",
  error: "AlertTriangle",
  warning: "AlertCircle",
  info: "Info",
};
const SEVERITY_TONE: Record<NotificationSeverity, string> = {
  success: "bg-success/10 text-success",
  error: "bg-danger/10 text-danger",
  warning: "bg-warning/10 text-warning",
  info: "bg-info/10 text-info",
};

const DELIVERY_TONE: Record<string, "success" | "danger" | "warning" | "neutral" | "info"> = {
  sent: "info", delivered: "success", failed: "danger", bounced: "danger", suppressed: "warning", pending: "neutral", queued: "neutral",
};

export default function NotificationsPage() {
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [total, setTotal] = useState(0);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<NotificationCategory | "">("");
  const [severity, setSeverity] = useState<NotificationSeverity | "">("");
  const [readFilter, setReadFilter] = useState<"all" | "unread" | "read">("all");

  useEffect(() => {
    let cancelled = false;
    const q: NotificationListQuery = { limit: 50 };
    if (query.trim()) q.q = query.trim();
    if (category) q.category = category;
    if (severity) q.severity = severity;
    if (readFilter === "unread") q.read = false;
    if (readFilter === "read") q.read = true;

    const run = async () => {
      setLoading(true);
      try {
        const data = await listNotificationsApi(q);
        if (cancelled) return;
        setItems(data.items);
        setTotal(data.total);
        setUnread(data.unread);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void run();
    return () => { cancelled = true; };
  }, [query, category, severity, readFilter]);

  const toggleRead = async (n: NotificationRecord) => {
    const next = !n.read;
    setItems((arr) => arr.map((x) => (x.id === n.id ? { ...x, read: next } : x)));
    setUnread((u) => Math.max(0, u + (next ? -1 : 1)));
    await markReadApi(n.id, next);
  };

  const markAll = async () => {
    const updated = await markAllReadApi();
    if (updated > 0) {
      setItems((arr) => arr.map((x) => ({ ...x, read: true })));
      setUnread(0);
    }
  };

  return (
    <div className="animate-float-up">
      <PageHeader
        title="Notifications"
        description={`${total} total${unread > 0 ? ` · ${unread} unread` : ""}`}
        actions={
          unread > 0 ? (
            <Button size="sm" variant="secondary" onClick={markAll}>
              <Icon name="CheckCheck" className="h-3.5 w-3.5" /> Mark all read
            </Button>
          ) : undefined
        }
      />

      <Card className="mb-4 p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Icon name="Search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notifications…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Pills
              value={category}
              onChange={(v) => setCategory(v as NotificationCategory | "")}
              options={[{ value: "", label: "All" }, ...CATEGORIES]}
            />
            <Pills
              value={severity}
              onChange={(v) => setSeverity(v as NotificationSeverity | "")}
              options={[{ value: "", label: "Any" }, ...SEVERITIES.map((s) => ({ value: s.value, label: s.label }))]}
            />
            <Pills
              value={readFilter}
              onChange={(v) => setReadFilter(v as typeof readFilter)}
              options={[
                { value: "all", label: "All" },
                { value: "unread", label: "Unread" },
                { value: "read", label: "Read" },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card className="divide-y divide-border">
        {loading && items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-fg-subtle">Loading…</div>
        ) : items.length === 0 ? (
          <div className="px-4 py-16 text-center">
            <Icon name="BellOff" className="mx-auto mb-3 h-6 w-6 text-fg-subtle" />
            <div className="text-sm font-medium">No notifications</div>
            <div className="text-xs text-fg-subtle">Notifications for your workflows, AI agents, billing and security will appear here.</div>
          </div>
        ) : (
          items.map((n) => (
            <div key={n.id}>
              <div
                className={cn(
                  "flex cursor-pointer gap-3 px-4 py-3 transition-colors hover:bg-surface-2/40",
                  !n.read && "bg-brand-soft/30",
                )}
                onClick={() => setExpanded((e) => (e === n.id ? null : n.id))}
              >
                <span className={cn("mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg", SEVERITY_TONE[n.severity])}>
                  <Icon name={SEVERITY_ICON[n.severity]} className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{n.title}</span>
                    {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    <Badge tone="neutral" className="ml-auto px-1.5 py-0 text-[9px]">{n.category}</Badge>
                  </div>
                  <div className="text-xs text-fg-muted line-clamp-2">{n.body}</div>
                  <div className="mt-1 flex items-center gap-2 text-[10px] text-fg-subtle">
                    <span>{relativeTime(n.createdAt)}</span>
                    {n.deliveries && n.deliveries.length > 0 && (
                      <span>· {n.deliveries.length} delivery {n.deliveries.length === 1 ? "attempt" : "attempts"}</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); void toggleRead(n); }}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"
                  aria-label={n.read ? "Mark unread" : "Mark read"}
                >
                  <Icon name={n.read ? "MailOpen" : "Mail"} className="h-3.5 w-3.5" />
                </button>
              </div>

              {expanded === n.id && (
                <div className="bg-surface-2/30 px-4 py-3">
                  <div className="mb-2 text-[11px] font-medium text-fg-muted">Delivery audit</div>
                  {n.deliveries && n.deliveries.length > 0 ? (
                    <div className="space-y-1.5">
                      {n.deliveries.map((d) => (
                        <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface-2/40 px-3 py-2 text-xs">
                          <Badge tone={DELIVERY_TONE[d.status] ?? "neutral"}>{d.status}</Badge>
                          <span className="text-fg-muted">{d.channel} · {d.provider}</span>
                          <span className="text-fg-subtle">attempts: {d.attempts}</span>
                          {d.sentAt && <span className="text-fg-subtle">sent {relativeTime(d.sentAt)}</span>}
                          {d.error && <span className="text-danger">· {d.error}</span>}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-fg-subtle">In-app only (no email delivery for this notification).</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </Card>
    </div>
  );
}

function Pills<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-2/40 p-1">
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs transition-colors",
            value === o.value ? "bg-brand-soft text-brand" : "text-fg-muted hover:text-fg",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}