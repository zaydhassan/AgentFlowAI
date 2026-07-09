"use client";

import Link from "next/link";
import { useState } from "react";
import { useSession } from "next-auth/react";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";

export function MarketingNav() {
  const [open, setOpen] = useState(false);
  // Reflect auth state so signed-in visitors see a profile menu instead of
  // "Sign in". Session is fetched client-side via the global SessionProvider
  // (status is "loading" on first paint, then settles).
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-border/60 bg-bg/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-6 px-5 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand to-ai shadow-[0_6px_20px_-6px_rgba(124,92,255,0.8)]">
            <LogoMark className="h-4 w-4 text-white" />
          </div>
          <span className="text-base font-semibold tracking-tight">AgentFlow<span className="text-brand"> AI</span></span>
        </Link>

        <nav className="ml-6 hidden md:flex items-center gap-7 text-sm text-fg-muted">
          <Link href="/#features" className="hover:text-fg transition-colors">Features</Link>
          <Link href="/#ai" className="hover:text-fg transition-colors">AI Engine</Link>
          <Link href="/#nodes" className="hover:text-fg transition-colors">Nodes</Link>
          <Link href="/pricing" className="hover:text-fg transition-colors">Pricing</Link>
          <Link href="/marketplace" className="hover:text-fg transition-colors">Templates</Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {signedIn ? (
            <UserMenu user={session?.user ?? {}} />
          ) : (
            <>
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button size="sm">
                  Start free <Icon name="ArrowRight" className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </>
          )}
          <button className="md:hidden grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:bg-surface-2" onClick={() => setOpen((o) => !o)}>
            <Icon name={open ? "X" : "Menu"} className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border bg-bg-soft px-5 py-3 space-y-1">
          {[["Features", "/#features"], ["AI Engine", "/#ai"], ["Nodes", "/#nodes"], ["Pricing", "/pricing"], ["Templates", "/marketplace"]].map(([l, h]) => (
            <Link key={l} href={h} className="block rounded-lg px-3 py-2 text-sm text-fg-muted hover:bg-surface-2" onClick={() => setOpen(false)}>{l}</Link>
          ))}
        </div>
      )}
    </header>
  );
}