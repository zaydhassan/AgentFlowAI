"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { notifications as seedNotifications } from "@/lib/mock/data";
import type { Notification } from "@/lib/types";
import { UserMenu } from "@/components/layout/user-menu";
import { useDropdown } from "@/lib/hooks/use-dropdown";

type ShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function Topbar({ onOpenCommand, user }: { onOpenCommand: () => void; user: ShellUser }) {
  const router = useRouter();
  const {
    open: notifOpen,
    toggle: toggleNotif,
    panelRef: notifPanelRef,
    triggerRef: notifTriggerRef,
  } = useDropdown<HTMLButtonElement>("topbar-notifications");
  const [items, setItems] = useState<Notification[]>(seedNotifications);
  const [creating, setCreating] = useState(false);

  const newWorkflow = async () => {
    if (creating) return;
    setCreating(true);
    try {
      const res = await fetch("/api/workflows", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({}) });
      if (res.ok) {
        const { id } = await res.json();
        if (id) router.push(`/workflows/${id}`);
        return;
      }
      if (res.status === 401) router.push("/login?callbackUrl=/workflows");
    } finally {
      setCreating(false);
    }
  };

  const unread = items.filter((n) => !n.read).length;
  const markAll = () => setItems((arr) => arr.map((n) => ({ ...n, read: true })));

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Mobile logo */}
      <Link href="/" className="flex lg:hidden items-center gap-2">
        <div className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand to-ai">
          <LogoMark className="h-3.5 w-3.5 text-white" />
        </div>
      </Link>

      {/* Command trigger */}
      <button
        onClick={onOpenCommand}
        className="group flex h-9 flex-1 max-w-md items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-3 text-sm text-fg-subtle hover:border-border-strong transition-colors"
      >
        <Icon name="Search" className="h-4 w-4" />
        <span className="flex-1 text-left">Search workflows, nodes, docs…</span>
        <kbd className="hidden sm:flex items-center gap-0.5 rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-muted">
          ⌘K
        </kbd>
      </button>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Running agents */}
        <div className="hidden md:flex items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 py-1.5 text-xs">
          <span className="dot dot-live bg-success" />
          <span className="text-fg-muted">12 agents running</span>
        </div>

        <Button variant="ai" size="sm" className="hidden sm:inline-flex" onClick={newWorkflow} disabled={creating}>
          <Icon name={creating ? "LoaderCircle" : "Sparkles"} className={cn("h-3.5 w-3.5", creating && "animate-spin")} />
          New Workflow
        </Button>

        {/* Notifications */}
        <div className="relative">
          <button
            ref={notifTriggerRef}
            onClick={toggleNotif}
            aria-haspopup="menu"
            aria-expanded={notifOpen}
            className="relative grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
          >
            <Icon name="Bell" className="h-4 w-4" />
            {unread > 0 && (
              <span className="absolute right-1.5 top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[9px] font-semibold text-white">
                {unread}
              </span>
            )}
          </button>
          {notifOpen && (
            <Dropdown panelRef={notifPanelRef} className="w-80">
              <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                <span className="text-sm font-semibold">Notifications</span>
                <button onClick={markAll} className="text-xs text-brand hover:underline">
                  Mark all read
                </button>
              </div>
              <div className="max-h-80 overflow-y-auto">
                {items.map((n) => (
                  <div
                    key={n.id}
                    className={cn("flex gap-3 px-3 py-2.5 border-b border-border/60", !n.read && "bg-brand-soft/40")}
                  >
                    <span
                      className={cn(
                        "mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-lg",
                        n.type === "success" && "bg-success/10 text-success",
                        n.type === "error" && "bg-danger/10 text-danger",
                        n.type === "warning" && "bg-warning/10 text-warning",
                        n.type === "info" && "bg-info/10 text-info"
                      )}
                    >
                      <Icon
                        name={
                          n.type === "success" ? "CheckCircle2" : n.type === "error" ? "AlertTriangle" : n.type === "warning" ? "AlertCircle" : "Info"
                        }
                        className="h-3.5 w-3.5"
                      />
                    </span>
                    <div className="min-w-0">
                      <div className="text-xs font-medium truncate">{n.title}</div>
                      <div className="text-[11px] text-fg-muted line-clamp-2">{n.body}</div>
                      <div className="text-[10px] text-fg-subtle mt-0.5">{relativeTime(n.timestamp)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Dropdown>
          )}
        </div>

        {/* User — shared profile menu (same component as the marketing navbar) */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}

function Dropdown({
  children,
  panelRef,
  className,
}: {
  children: React.ReactNode;
  panelRef: React.RefObject<HTMLDivElement | null>;
  className?: string;
}) {
  // No overlay hack: outside-click + Escape + single-open coordination are handled
  // by the useDropdown hook in the parent. This is just the presentational panel.
  return (
    <div
      ref={panelRef}
      className={cn(
        "absolute right-0 top-11 z-50 overflow-hidden rounded-xl border border-border bg-surface-2/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-float-up",
        className
      )}
    >
      {children}
    </div>
  );
}

// local copy of relativeTime to avoid a circular import shape
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
