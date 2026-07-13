"use client";

// Single shared profile menu used everywhere the signed-in avatar appears
// (marketing navbar + dashboard topbar). One source of truth so the dropdown
// is identical across the whole app.
//
// Premium behaviour:
//  - Spring entrance + staggered items (framer-motion AnimatePresence).
//  - Hover highlight + icon tint shift per row.
//  - Esc-to-close, click-outside overlay, focus rings.
//  - Theme picker retained (it lives on a shared component, so the marketing
//    pages can still switch themes).

import { useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
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

// Primary nav rows. Every href resolves to a real page — no fake links.
const MENU_ITEMS = [
  { label: "Profile", icon: "User", href: "/settings" },
  { label: "Workspace", icon: "LayoutGrid", href: "/dashboard" },
  { label: "Billing", icon: "CreditCard", href: "/settings/billing" },
  { label: "Integrations", icon: "Plug", href: "/settings/integrations" },
  { label: "API Keys", icon: "KeyRound", href: "/settings" },
  { label: "Settings", icon: "Settings", href: "/settings" },
];

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.035, delayChildren: 0.04 } },
};
const item: Variants = {
  hidden: { opacity: 0, x: 6 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 480, damping: 34 } },
};

export function UserMenu({ user }: { user: UserMenuUser }) {
  const [open, setOpen] = useState(false);
  const [signingOut, startSignOut] = useTransition();
  const { theme, setTheme } = useTheme();
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Esc closes the menu and returns focus to the trigger.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const handleSignOut = () => {
    startSignOut(() => {
      signOut({ callbackUrl: "/" });
    });
  };

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1 pr-2 transition-colors hover:bg-surface-2 focus-ring"
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <div className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-brand to-ai text-[11px] font-semibold text-white">
            {initials(user.name, user.email)}
          </div>
        )}
        <div className="hidden text-left leading-tight sm:block">
          <div className="text-xs font-medium">{user.name ?? user.email ?? "Account"}</div>
          <div className="text-[10px] text-fg-subtle">{user.email}</div>
        </div>
        <Icon
          name="ChevronDown"
          className={cn("h-3.5 w-3.5 text-fg-subtle transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-outside overlay. */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 420, damping: 32 }}
              className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-surface-2/95 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] backdrop-blur-2xl"
            >
              {/* Identity header. */}
              <div className="border-b border-border px-3.5 py-2.5">
                <div className="text-sm font-medium truncate">{user.name ?? "Account"}</div>
                <div className="text-[11px] text-fg-muted truncate">{user.email}</div>
              </div>

              <motion.div variants={container} initial="hidden" animate="show" className="p-1.5">
                {MENU_ITEMS.map((m) => (
                  <motion.div key={m.label} variants={item}>
                    <Link
                      role="menuitem"
                      href={m.href}
                      onClick={() => setOpen(false)}
                      className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg focus-ring"
                    >
                      <Icon name={m.icon} className="h-3.5 w-3.5 text-fg-subtle transition-colors group-hover:text-brand" />
                      <span className="flex-1">{m.label}</span>
                    </Link>
                  </motion.div>
                ))}
              </motion.div>

              {/* Theme switcher. */}
              <div className="border-t border-border px-1.5 py-1.5">
                <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                  Theme
                </div>
                <div className="flex items-center gap-1 px-1">
                  {THEME_OPTIONS.map((opt) => {
                    const active = theme === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setTheme(opt.value)}
                        aria-pressed={active}
                        className={cn(
                          "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs transition-colors focus-ring",
                          active ? "bg-brand-soft text-fg" : "text-fg-muted hover:text-fg hover:bg-surface-3"
                        )}
                      >
                        <Icon name={opt.icon} className="h-3.5 w-3.5" />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sign out. */}
              <div className="border-t border-border p-1.5">
                <button
                  type="button"
                  role="menuitem"
                  onClick={handleSignOut}
                  disabled={signingOut}
                  className="group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-fg-muted transition-colors hover:bg-surface-3 hover:text-fg disabled:opacity-60 focus-ring"
                >
                  <Icon name="LogOut" className="h-3.5 w-3.5 text-fg-subtle transition-colors group-hover:text-danger" />
                  {signingOut ? "Signing out…" : "Sign out"}
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}