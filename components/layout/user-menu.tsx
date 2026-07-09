"use client";

// Single shared profile menu used everywhere the signed-in avatar appears
// (marketing navbar + dashboard topbar). One source of truth so the dropdown
// is identical across the whole app.
import { useState, useTransition } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/components/theme-provider";

export type UserMenuUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

function initials(name?: string | null, email?: string | null): string {
  const source = (name && name.trim()) || (email ? email.split("@")[0] : "") || "?";
  return source
    .split(/[\s_.-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
}

const THEME_OPTIONS: { value: Theme; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "Sun" },
  { value: "dark", label: "Dark", icon: "Moon" },
  { value: "system", label: "System", icon: "Monitor" },
];

const MENU_ITEMS = [
  { label: "Dashboard", icon: "LayoutDashboard", href: "/dashboard" },
  { label: "Profile", icon: "User", href: "/settings" },
  { label: "Account settings", icon: "Settings", href: "/settings" },
  { label: "API keys", icon: "KeyRound", href: "/settings" },
];

export function UserMenu({ user }: { user: UserMenuUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const { theme, setTheme } = useTheme();

  const handleSignOut = () => {
    startSignOut(() => {
      signOut({ callbackUrl: "/" });
    });
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 hover:bg-surface-2 transition-colors"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand to-ai text-[11px] font-semibold text-white">
            {initials(user.name, user.email)}
          </div>
        )}
        <div className="hidden sm:block text-left leading-tight">
          <div className="text-xs font-medium">{user.name ?? user.email ?? "Account"}</div>
          <div className="text-[10px] text-fg-subtle">{user.email}</div>
        </div>
        <Icon name="ChevronDown" className="h-3.5 w-3.5 text-fg-subtle" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-11 z-50 w-56 overflow-hidden rounded-xl border border-border bg-surface-2/95 backdrop-blur-xl shadow-2xl shadow-black/40 animate-float-up">
            <div className="px-3 py-2.5 border-b border-border">
              <div className="text-sm font-medium truncate">{user.name ?? "Account"}</div>
              <div className="text-[11px] text-fg-muted truncate">{user.email}</div>
            </div>
            {MENU_ITEMS.map((m) => (
              <Link
                key={m.label}
                href={m.href}
                onClick={() => setOpen(false)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-2"
              >
                <Icon name={m.icon} className="h-3.5 w-3.5" />
                {m.label}
              </Link>
            ))}

            <div className="border-t border-border px-1.5 py-1.5">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                Theme
              </div>
              {THEME_OPTIONS.map((opt) => {
                const active = theme === opt.value;
                return (
                  <button
                    key={opt.value}
                    onClick={() => setTheme(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                      active ? "bg-brand-soft text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-2"
                    )}
                  >
                    <Icon name={opt.icon} className="h-3.5 w-3.5" />
                    <span className="flex-1 text-left">{opt.label}</span>
                    {active && <Icon name="Check" className="h-3.5 w-3.5 text-brand" />}
                  </button>
                );
              })}
            </div>

            <div className="border-t border-border">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={signingOut}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-2 disabled:opacity-60"
              >
                <Icon name="LogOut" className="h-3.5 w-3.5" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}