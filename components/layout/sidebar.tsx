"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { pickActiveHref } from "@/lib/nav";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";

const nav = [
  { section: "Workspace", items: [
    { label: "Dashboard", href: "/dashboard", icon: "LayoutDashboard" },
    { label: "Workflows", href: "/workflows", icon: "Workflow" },
    { label: "Executions", href: "/executions", icon: "Activity" },
    { label: "Observability", href: "/observability", icon: "LineChart" },
  ]},
  { section: "Intelligence", items: [
    { label: "AI Copilot", href: "/ai", icon: "Sparkles" },
    { label: "Agents", href: "/ai/agents", icon: "Bot" },
    { label: "Memory", href: "/ai/memory", icon: "Brain" },
    { label: "RAG Sources", href: "/ai/rag", icon: "Library" },
  ]},
  { section: "Resources", items: [
    { label: "Marketplace", href: "/marketplace", icon: "Store" },
    { label: "Settings", href: "/settings", icon: "Settings" },
    { label: "Billing", href: "/settings/billing", icon: "CreditCard" },
  ]},
];

// Flat list of every sidebar href — used to pick the single most-specific match
// for the current pathname so exactly ONE item is ever active (no more
// "/ai" + "/ai/rag" both lighting up on a nested route).
const ALL_HREFS = nav.flatMap((g) => g.items.map((i) => i.href));

export function Sidebar({ user: _user }: { user: { id: string; name: string | null; email: string | null; image: string | null } }) {
  const pathname = usePathname();
  const activeHref = pickActiveHref(pathname, ALL_HREFS);
  return (
    <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-bg-soft/80 backdrop-blur-xl">
      <Link href="/" className="flex h-14 items-center gap-2.5 px-5 border-b border-border hover:bg-surface-2/60 transition-colors">
        <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai shadow-[0_6px_20px_-6px_rgba(124,92,255,0.8)]">
          <LogoMark className="h-4 w-4 text-white" />
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold tracking-tight">AgentFlow</div>
          <div className="text-[10px] text-fg-subtle uppercase tracking-widest">AI Platform</div>
        </div>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {nav.map((group) => (
          <div key={group.section}>
            <div className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              {group.section}
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                // Exactly one winner: the item whose href equals the
                // most-specific match for the current pathname. Derived purely
                // from routing — no hardcoded active flags anywhere.
                const active = item.href === activeHref;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-brand-soft text-fg border border-brand/30"
                        : "text-fg-muted hover:text-fg hover:bg-surface-2 border border-transparent"
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className={cn("h-4 w-4 shrink-0", active ? "text-brand" : "text-fg-subtle group-hover:text-fg")}
                    />
                    {item.label}
                    {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-brand" />}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="border-t border-border p-3">
        <div className="rounded-lg border border-border bg-surface-2/60 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="text-fg-muted">Credits</span>
            <span className="font-medium text-fg">142.5k</span>
          </div>
          <div className="mt-2 h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
            <div className="h-full w-[78%] rounded-full bg-gradient-to-r from-brand to-ai" />
          </div>
          <div className="mt-1.5 text-[10px] text-fg-subtle">78% used this month</div>
        </div>
      </div>
    </aside>
  );
}
