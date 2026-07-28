"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { UserMenu } from "@/components/layout/user-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";

type ShellUser = {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
};

export function Topbar({ onOpenCommand, onOpenSidebar, user }: { onOpenCommand: () => void; onOpenSidebar: () => void; user: ShellUser }) {
  const router = useRouter();
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

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/80 backdrop-blur-xl px-4 lg:px-6">
      {/* Mobile menu trigger — opens the slide-in sidebar drawer (lg+ hides it; the static rail is always visible there) */}
      <button
        type="button"
        onClick={onOpenSidebar}
        aria-label="Open menu"
        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-surface-2/60 text-fg-muted transition-colors hover:border-border-strong hover:text-fg lg:hidden"
      >
        <Icon name="Menu" className="h-4 w-4" />
      </button>

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

        {/* Notifications — real, DB-backed center (replaces the mock bell) */}
        <NotificationsBell />

        {/* User — shared profile menu (same component as the marketing navbar) */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
