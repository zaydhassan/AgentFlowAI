"use client";

// AgentFlow AI — world-class marketing navbar.
//
// Behaviour:
//  - Sticky; shrinks slightly, gains blur + shadow once scrolled.
//  - Hides on scroll-down, reappears on scroll-up (spring-animated).
//  - Desktop links: Solutions + Platform dropdown mega-panels, then
//    Templates / Developers / Pricing / Enterprise direct links.
//  - AI status badge (top-right), magnetic "Get Started" CTA, shared UserMenu.
//  - Hover: animated underline + soft highlight; active page indicator
//    slides between links (framer-motion layoutId).
//  - Mobile: slide-out drawer from the right with accordion sub-links.
//  - ARIA labels, keyboard focus rings, Esc-to-close drawer/dropdown.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValueEvent,
  useScroll,
  type Variants,
} from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { LogoMark } from "@/components/ui/logo";
import { Button } from "@/components/ui/button";
import { UserMenu } from "@/components/layout/user-menu";
import { GetStartedButton } from "@/components/marketing/get-started-button";
import { cn } from "@/lib/utils";
import { isRouteActive } from "@/lib/nav";

type MegaItem = { label: string; href: string; desc?: string; icon: string };
type NavEntry =
  | { kind: "link"; label: string; href: string }
  | { kind: "mega"; label: string; items: MegaItem[] };

const NAV: NavEntry[] = [
  {
    kind: "mega",
    label: "Solutions",
    items: [
      { label: "AI Workflow Builder", href: "/workflows", desc: "Visual, drag-and-drop agent orchestration", icon: "Workflow" },
      { label: "AI Engine", href: "/#ai", desc: "Plan → Reason → Execute → Learn runtime", icon: "Sparkles" },
      { label: "Node Library", href: "/#nodes", desc: "200+ prebuilt integrations & tools", icon: "Boxes" },
    ],
  },
  {
    kind: "mega",
    label: "Platform",
    items: [
      { label: "Documentation", href: "/docs", desc: "Guides, API reference, quickstarts", icon: "BookOpen" },
      { label: "Changelog", href: "/changelog", desc: "What shipped, week by week", icon: "GitBranch" },
      { label: "Security", href: "/security", desc: "SOC 2, encryption, isolation", icon: "ShieldCheck" },
    ],
  },
  { kind: "link", label: "Templates", href: "/marketplace" },
  { kind: "link", label: "Developers", href: "/docs" },
  { kind: "link", label: "Pricing", href: "/pricing" },
  { kind: "link", label: "Enterprise", href: "/contact" },
];

function isActive(pathname: string, href: string): boolean {
  if (href.startsWith("/#")) return false;
  return isRouteActive(pathname, href);
}

function megaActive(pathname: string, items: MegaItem[]): boolean {
  return items.some((i) => isActive(pathname, i.href));
}

// Mobile drawer — cascade the nav list in on open.
const drawerContainer: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.04, delayChildren: 0.08 } },
};
const drawerItem: Variants = {
  hidden: { opacity: 0, x: 10 },
  show: { opacity: 1, x: 0, transition: { type: "spring", stiffness: 420, damping: 32 } },
};

export function MarketingNav() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const signedIn = status === "authenticated";

  const { scrollY } = useScroll();
  const [hidden, setHidden] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const lastY = useRef(0);

  useMotionValueEvent(scrollY, "change", (y) => {
    const prev = lastY.current;
    lastY.current = y;
    setScrolled(y > 8);
   
    if (y > 160 && y > prev + 4) setHidden(true);
    else if (y < prev - 4 || y <= 160) setHidden(false);
  });

  const [openMega, setOpenMega] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const [drawerMega, setDrawerMega] = useState<string | null>(null);

  useEffect(() => {
    setOpenMega(null);
    setDrawer(false);
    setDrawerMega(null);
  }, [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <motion.header
      className={cn(
        "nav-shell nav-edge fixed top-0 inset-x-0 z-50",

        scrolled
          ? "h-16 border-b border-border/70 bg-bg/70 shadow-[0_1px_0_0_rgba(0,0,0,0.04),0_8px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl"
          : "h-[72px] border-b border-border/50 bg-bg/65 backdrop-blur-xl"
      )}
      initial={false}
      animate={{ y: hidden ? "-115%" : "0%" }}
      transition={{ type: "spring", stiffness: 380, damping: 38, mass: 0.6 }}
    >
      <div className="relative flex h-full items-center gap-6 px-5 lg:px-8">
        {/* Logo — premium flagship tile + wordmark. Sits flush to the
            viewport's left edge (the bar spans full width, no max-width
            centering), so the brand leads the page from the far left. */}
        <Link href="/" className="group flex shrink-0 items-center gap-2.5 rounded-lg focus-ring" aria-label="AgentFlow AI home">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            transition={{ type: "spring", stiffness: 420, damping: 26 }}
            className="relative grid h-9 w-9 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand via-brand-2 to-ai shadow-[0_8px_24px_-10px_rgba(124,92,255,0.65)] ring-1 ring-inset ring-white/10"
          >
            {/* Top sheen — a soft light-from-above highlight inside the tile. */}
            <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
            <LogoMark className="relative h-[18px] w-[18px] text-white" />
          </motion.div>
          <span className="text-[15px] font-semibold tracking-[-0.01em]">
            AgentFlow<span className="text-brand"> AI</span>
          </span>
        </Link>

        {/* Desktop nav. Centered in the viewport on xl+ (absolute, half-width
            translate); on lg it sits right after the brand to avoid colliding
            with the right-side cluster on narrower desktop widths. */}
        <nav aria-label="Primary" className="hidden lg:flex items-center gap-1 xl:absolute xl:left-1/2 xl:top-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2">
          {NAV.map((entry) =>
            entry.kind === "link" ? (
              <NavLink
                key={entry.label}
                label={entry.label}
                href={entry.href}
                active={isActive(pathname, entry.href)}
              />
            ) : (
              <MegaLink
                key={entry.label}
                label={entry.label}
                items={entry.items}
                active={megaActive(pathname, entry.items)}
                open={openMega === entry.label}
                onOpenChange={(o) => setOpenMega(o ? entry.label : null)}
              />
            )
          )}
        </nav>

        {/* Right cluster: AI status + CTA + auth + mobile trigger. */}
        <div className="ml-auto flex items-center gap-2.5 sm:gap-3.5">
          <AIStatusBadge className="flex" />

          {signedIn ? (
            <UserMenu user={session?.user ?? {}} />
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/login" className="hidden sm:block">
                <Button variant="ghost" size="sm">Sign in</Button>
              </Link>
              <GetStartedButton href="/signup" label="Start free" />
            </div>
          )}

          {/* Mobile drawer trigger. */}
          <button
            type="button"
            onClick={() => setDrawer(true)}
            aria-label="Open menu"
            aria-expanded={drawer}
            className="lg:hidden grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors focus-ring"
          >
            <Icon name="Menu" className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Mobile slide-out drawer. */}
      <MobileDrawer
        open={drawer}
        onClose={() => setDrawer(false)}
        signedIn={signedIn}
        pathname={pathname}
        drawerMega={drawerMega}
        setDrawerMega={setDrawerMega}
      />
    </motion.header>
  );
}

function NavLink({ label, href, active }: { label: string; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group relative flex h-9 items-center rounded-lg px-3.5 text-sm transition-colors duration-200 focus-ring",
        active ? "text-fg" : "text-fg-muted hover:text-fg"
      )}
    >
      {/* Hover wash (non-active only — active uses the sliding pill below). */}
      {!active && (
        <span className="absolute inset-0 rounded-lg bg-surface-2/0 transition-colors duration-200 group-hover:bg-surface-2/70" />
      )}
      {/* Sliding active pill — shared layoutId animates it between links. */}
      {active && (
        <motion.span
          layoutId="nav-active-pill"
          className="nav-active-pill pointer-events-none absolute inset-0 rounded-lg"
          initial={false}
          transition={{ type: "spring", stiffness: 420, damping: 32 }}
        />
      )}
      {/* Hover underline accent for non-active links. */}
      {!active && (
        <span className="pointer-events-none absolute bottom-1 left-3.5 right-3.5 h-px overflow-hidden rounded-full">
          <motion.span
            className="block h-full origin-left bg-gradient-to-r from-brand to-ai"
            initial={false}
            animate={{ scaleX: 0 }}
            whileHover={{ scaleX: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
          />
        </span>
      )}
      <span className="relative z-10">{label}</span>
    </Link>
  );
}

function MegaLink({
  label,
  items,
  active,
  open,
  onOpenChange,
}: {
  label: string;
  items: MegaItem[];
  active: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  
  return (
    <div
      className="relative"
      onMouseEnter={() => onOpenChange(true)}
      onMouseLeave={() => onOpenChange(false)}
    >
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => onOpenChange(!open)}
        className={cn(
          "group flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-sm transition-colors duration-200 focus-ring",
          active || open ? "text-fg" : "text-fg-muted hover:text-fg"
        )}
      >
        {label}
        <Icon
          name="ChevronDown"
          className={cn("h-4 w-4 text-fg-subtle transition-transform duration-200", open && "rotate-180")}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 420, damping: 32 }}
            className="absolute left-1/2 top-full mt-1.5 z-50 w-[24rem] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface-2/90 backdrop-blur-2xl shadow-[0_24px_60px_-24px_rgba(0,0,0,0.6)]"
          >
            <div className="grid grid-cols-1 gap-1 p-2">
              {items.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  role="menuitem"
                  onClick={() => onOpenChange(false)}
                  className="group/item flex items-start gap-3 rounded-xl p-2.5 transition-colors duration-200 hover:bg-surface-3 focus-ring"
                >
                  <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand transition-colors duration-200 group-hover/item:bg-brand-soft/70 group-hover/item:text-ai">
                    <Icon name={item.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-fg">{item.label}</span>
                    {item.desc && (
                      <span className="mt-0.5 block text-xs text-fg-muted">{item.desc}</span>
                    )}
                  </span>
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AIStatusBadge({ className }: { className?: string }) {
  return (
    <div
      role="status"
      aria-label="All systems operational"
      title="AI engine online — 99.98% uptime"
      className={cn(
        "group flex items-center gap-2 rounded-full border border-border bg-surface-2/60 px-2.5 py-1 text-xs transition-colors duration-200 hover:border-border-strong hover:bg-surface-3/70",
        className
      )}
    >
      <span className="status-dot relative inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-success" />
      <span className="hidden lg:inline text-fg-muted">
        <span className="text-fg">All Systems</span> Operational
      </span>
      <span className="hidden sm:inline lg:hidden text-fg-muted">
        <span className="text-fg">Operational</span>
      </span>
    </div>
  );
}

function MobileDrawer({
  open,
  onClose,
  signedIn,
  pathname,
  drawerMega,
  setDrawerMega,
}: {
  open: boolean;
  onClose: () => void;
  signedIn: boolean;
  pathname: string;
  drawerMega: string | null;
  setDrawerMega: (v: string | null) => void;
}) {
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm lg:hidden"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 360, damping: 38 }}
            className="fixed right-0 top-0 z-50 flex h-dvh w-[82%] max-w-sm flex-col border-l border-border bg-surface/95 backdrop-blur-2xl shadow-2xl lg:hidden"
            role="dialog"
            aria-label="Menu"
          >
            <div className="flex h-14 items-center justify-between border-b border-border px-5">
              <div className="flex items-center gap-2.5">
                <div className="relative grid h-8 w-8 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-brand via-brand-2 to-ai ring-1 ring-inset ring-white/10">
                  <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
                  <LogoMark className="relative h-4 w-4 text-white" />
                </div>
                <span className="text-sm font-semibold tracking-[-0.01em]">
                  AgentFlow<span className="text-brand"> AI</span>
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="grid h-9 w-9 place-items-center rounded-lg text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors focus-ring"
              >
                <Icon name="X" className="h-4 w-4" />
              </button>
            </div>

            <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-4">
              <motion.div variants={drawerContainer} initial="hidden" animate="show">
                {NAV.map((entry) =>
                  entry.kind === "link" ? (
                    <motion.div key={entry.label} variants={drawerItem}>
                      <Link
                        href={entry.href}
                        onClick={onClose}
                        aria-current={isActive(pathname, entry.href) ? "page" : undefined}
                        className={cn(
                          "relative block rounded-lg px-3 py-2.5 text-sm transition-colors hover:bg-surface-2",
                          isActive(pathname, entry.href)
                            ? "bg-surface-2 text-fg"
                            : "text-fg-muted"
                        )}
                      >
                        {isActive(pathname, entry.href) && (
                          <span aria-hidden className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-gradient-to-b from-brand to-ai" />
                        )}
                        {entry.label}
                      </Link>
                    </motion.div>
                  ) : (
                    <motion.div key={entry.label} variants={drawerItem} className="py-0.5">
                    <button
                      type="button"
                      onClick={() =>
                        setDrawerMega(drawerMega === entry.label ? null : entry.label)
                      }
                      aria-expanded={drawerMega === entry.label}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-sm text-fg-muted hover:bg-surface-2 transition-colors focus-ring"
                    >
                      {entry.label}
                      <Icon
                        name="ChevronDown"
                        className={cn(
                          "h-3.5 w-3.5 transition-transform duration-200",
                          drawerMega === entry.label && "rotate-180"
                        )}
                      />
                    </button>
                    <AnimatePresence initial={false}>
                      {drawerMega === entry.label && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="ml-3 border-l border-border pl-3">
                            {entry.items.map((item) => (
                              <Link
                                key={item.label}
                                href={item.href}
                                onClick={onClose}
                                className="block rounded-lg px-3 py-2 text-sm text-fg-muted hover:text-fg hover:bg-surface-2 transition-colors"
                              >
                                {item.label}
                              </Link>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              )}
              </motion.div>
            </nav>

            <div className="border-t border-border p-4 space-y-2">
              <AIStatusBadge className="w-full justify-center" />
              {signedIn ? (
                <Link href="/dashboard" onClick={onClose}>
                  <Button variant="secondary" size="md" className="w-full">
                    Go to dashboard
                  </Button>
                </Link>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link href="/login" onClick={onClose}>
                    <Button variant="ghost" size="md" className="w-full">Sign in</Button>
                  </Link>
                  <GetStartedButton href="/signup" label="Start free" className="w-full" />
                </div>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}