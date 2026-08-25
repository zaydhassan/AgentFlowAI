"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useDropdown } from "@/lib/hooks/use-dropdown";
import { useNotifications } from "@/lib/hooks/use-notifications";
import type { NotificationSeverity } from "@/lib/notifications/client";

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

const CATEGORY_LABEL: Record<string, string> = {
  workflow: "Workflow",
  ai: "AI",
  integration: "Integration",
  billing: "Billing",
  security: "Security",
  system: "System",
};

function relativeTime(date: Date | string): string {
  const d = typeof date === "string" ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationsBell() {
  const { open, toggle, panelRef, triggerRef } = useDropdown<HTMLButtonElement>("topbar-notifications");
  const { items, unread, loading, markRead, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Notifications${unread > 0 ? ` (${unread} unread)` : ""}`}
        className="relative grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
      >
        <Icon name="Bell" className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          ref={panelRef}
          className="absolute right-0 top-11 z-50 w-[22rem] overflow-hidden rounded-xl border border-border bg-surface-2/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-float-up"
        >
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
            <span className="text-sm font-semibold">Notifications</span>
            <div className="flex items-center gap-2">
              {unread > 0 && (
                <button onClick={() => void markAllRead()} className="text-xs text-brand hover:underline">
                  Mark all read
                </button>
              )}
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {loading && items.length === 0 ? (
              <div className="px-3 py-6 text-center text-xs text-fg-subtle">Loading…</div>
            ) : items.length === 0 ? (
              <div className="px-3 py-8 text-center">
                <Icon name="BellOff" className="mx-auto mb-2 h-5 w-5 text-fg-subtle" />
                <div className="text-xs text-fg-muted">You&apos;re all caught up.</div>
              </div>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  onClick={() => void markRead(n.id, !n.read)}
                  className={cn(
                    "flex w-full gap-3 px-3 py-2.5 border-b border-border/60 text-left transition-colors hover:bg-surface-3/50",
                    !n.read && "bg-brand-soft/40",
                  )}
                >
                  <span className={cn("mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg", SEVERITY_TONE[n.severity])}>
                    <Icon name={SEVERITY_ICON[n.severity]} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium truncate">{n.title}</span>
                      {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-brand" />}
                    </div>
                    <div className="text-[11px] text-fg-muted line-clamp-2">{n.body}</div>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <Badge tone="neutral" className="px-1.5 py-0 text-[9px]">{CATEGORY_LABEL[n.category] ?? n.category}</Badge>
                      <span className="text-[10px] text-fg-subtle">{relativeTime(n.createdAt)}</span>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="border-t border-border px-3 py-2">
            <Link href="/notifications" className="flex items-center justify-center gap-1.5 text-xs font-medium text-brand hover:underline">
              View all notifications <Icon name="ArrowRight" className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}