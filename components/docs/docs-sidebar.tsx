"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { docNav } from "@/lib/docs/navigation";
import { pickActiveHref } from "@/lib/nav";

// Every candidate href (docs home + all articles). We pick the single
// most-specific match so exactly ONE row is active at a time — e.g. on
// /docs/workflows only the Workflows row lights up, never its neighbours,
// and the "All documentation" home link is only active on /docs itself.
const ALL_DOC_HREFS = ["/docs", ...docNav.flatMap((g) => g.items.map((i) => i.href))];

export function DocsSidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const activeHref = pickActiveHref(pathname, ALL_DOC_HREFS);

  return (
    <nav aria-label="Documentation" className="space-y-7">
      {/* Back to docs home. */}
      <Link
        href="/docs"
        onClick={onNavigate}
        aria-current={activeHref === "/docs" ? "page" : undefined}
        className={cn(
          "inline-flex items-center gap-2 text-sm transition-colors",
          activeHref === "/docs" ? "text-fg" : "text-fg-muted hover:text-fg",
        )}
      >
        <Icon name="ArrowLeft" className="h-3.5 w-3.5" />
        All documentation
      </Link>

      {docNav.map((group) => (
        <div key={group.title}>
          <h3 className="mb-2.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
            {group.title}
          </h3>
          <ul className="space-y-0.5 border-l border-border">
            {group.items.map((item) => {
              const active = item.href === activeHref;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative -ml-px flex items-center gap-2.5 border-l-2 py-1.5 pl-3 text-sm transition-colors",
                      active
                        ? "border-brand text-fg"
                        : "border-transparent text-fg-muted hover:text-fg hover:border-border-strong",
                    )}
                  >
                    <Icon
                      name={item.icon}
                      className={cn("h-3.5 w-3.5 shrink-0", active ? "text-brand" : "text-fg-subtle")}
                    />
                    <span className="truncate">{item.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}