"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTheme, type Theme } from "@/components/theme-provider";
import { useDropdown } from "@/lib/hooks/use-dropdown";

export type UserMenuUser = {
  name?: string | null;
  email?: string | null;
  image?: string | null;
};

export function initials(name?: string | null, email?: string | null): string {
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

// Top-nav avatar. Falls back to a gradient initials tile whenever the image
// URL is missing OR fails to load at runtime (expired Google/GitHub URLs,
// deleted avatars, network/CSP failures). A subtle skeleton fills the fixed
// 7×7 box while the image loads so there's no layout shift.
export function UserAvatar({ user, size = "md" }: { user: UserMenuUser; size?: "md" | "lg" }) {
  const px = size === "lg" ? "h-11 w-11" : "h-8 w-8";
  const src = user.image?.trim() || null;
  // "error" doubles as "show fallback" — used both when there's no URL and
  // when the <img> fires onError.
  const [status, setStatus] = useState<"loading" | "loaded" | "error">(
    src ? "loading" : "error",
  );
  // Reset the load state when the URL changes (e.g. session update). Done
  // during render (guarded) rather than in an effect to avoid cascading
  // renders — the official "adjust state on prop change" pattern.
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setStatus(src ? "loading" : "error");
  }

  const fallback = (
    <div className={cn("grid place-items-center rounded-full bg-gradient-to-br from-brand to-ai font-semibold text-white", px, size === "lg" ? "text-sm" : "text-xs")}>
      {initials(user.name, user.email)}
    </div>
  );

  if (!src || status === "error") return fallback;

  return (
    <div className={cn("relative shrink-0", px)}>
      {/* Skeleton behind the image while it loads (same box → no shift). */}
      {status !== "loaded" && (
        <div
          className="absolute inset-0 rounded-full bg-surface-3 animate-pulse"
          aria-hidden
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        loading="eager"
        decoding="async"
        onLoad={() => setStatus("loaded")}
        onError={() => setStatus("error")}
        className={cn(
          "rounded-full object-cover transition-opacity duration-200",
          px,
          status === "loaded" ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

export function UserMenu({ user }: { user: UserMenuUser }) {
  const { open, close, toggle, panelRef, triggerRef } =
    useDropdown<HTMLButtonElement>("user-menu");
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
        ref={triggerRef}
        type="button"
        suppressHydrationWarning
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-lg p-1.5 pr-2.5 transition-colors hover:bg-surface-2 hover:ring-1 hover:ring-border focus-ring"
      >
        <UserAvatar user={user} />
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
          <motion.div
            ref={panelRef}
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute right-0 top-full mt-1.5 z-50 w-60 overflow-hidden rounded-2xl border border-border bg-surface-2/95 shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          >
            {/* Identity header. */}
            <div className="flex items-center gap-2.5 border-b border-border px-3.5 py-2.5">
              <UserAvatar user={user} />
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">{user.name ?? "Account"}</div>
                <div className="text-[11px] text-fg-muted truncate">{user.email}</div>
              </div>
            </div>

            <motion.div variants={container} initial="hidden" animate="show" className="p-1.5">
              {MENU_ITEMS.map((m) => (
                <motion.div key={m.label} variants={item}>
                  <Link
                    role="menuitem"
                    href={m.href}
                    onClick={() => close()}
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
        )}
      </AnimatePresence>
    </div>
  );
}