"use client";

import { useState } from "react";
import { useReducedMotion } from "framer-motion";
import { Icon } from "@/components/ui/icon";

export type TocItem = {
  id: string;
  title: string;
};

const focusClass =
  "rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/70 focus-visible:ring-offset-2 focus-visible:ring-offset-bg";

// Shared smooth-scroll handler: prevents the browser's instant jump and
// animates instead (unless the user prefers reduced motion).
function useTocScroll() {
  const reduceMotion = useReducedMotion();
  return (id: string) => (e: React.MouseEvent<HTMLAnchorElement>) => {
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    el.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    // Keep the URL shareable without re-triggering the browser's own jump.
    history.replaceState(null, "", `#${id}`);
  };
}

export function PrivacyToc({ items, activeId }: { items: TocItem[]; activeId: string | null }) {
  const scrollTo = useTocScroll();

  return (
    <nav aria-label="On this page">
      <h2 className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">
        <Icon name="List" className="h-3.5 w-3.5" aria-hidden />
        On this page
      </h2>
      <ul className="space-y-0.5">
        {items.map((item, i) => {
          const active = item.id === activeId;
          return (
            <li key={item.id} className="relative">
              {/* Purple→cyan indicator for the active item. */}
              {active && (
                <span
                  aria-hidden
                  className="absolute -inset-y-0.5 left-0 w-px bg-gradient-to-b from-brand to-ai"
                />
              )}
              <a
                href={`#${item.id}`}
                onClick={scrollTo(item.id)}
                aria-current={active ? "true" : undefined}
                className={`group flex items-baseline gap-3 py-1.5 pl-4 pr-2 text-sm transition-colors ${focusClass} ${
                  active ? "text-fg" : "text-fg-muted hover:text-fg"
                }`}
              >
                <span
                  className={`font-mono text-[11px] tabular-nums transition-colors ${
                    active ? "text-brand" : "text-fg-subtle group-hover:text-fg-muted"
                  }`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className="leading-snug">{item.title}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// Compact disclosure version of the TOC for small screens.
export function PrivacyTocMobile({ items, activeId }: { items: TocItem[]; activeId: string | null }) {
  const scrollTo = useTocScroll();
  const [open, setOpen] = useState(false);

  const activeIndex = activeId ? items.findIndex((it) => it.id === activeId) : -1;

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="group rounded-xl border border-border bg-surface-2/50 lg:hidden"
    >
      <summary
        className={`${focusClass} flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium`}
      >
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
          <Icon name="List" className="h-4 w-4 text-brand" aria-hidden />
          On this page
          {activeIndex >= 0 && (
            <span className="text-fg-subtle">
              · {String(activeIndex + 1).padStart(2, "0")} {items[activeIndex].title}
            </span>
          )}
        </span>
        <Icon
          name="ChevronDown"
          className="h-4 w-4 shrink-0 text-fg-subtle transition-transform group-open:rotate-180"
          aria-hidden
        />
      </summary>
      <ul className="border-t border-border px-2 py-2">
        {items.map((item, i) => (
          <li key={item.id}>
            <a
              href={`#${item.id}`}
              onClick={scrollTo(item.id)}
              className={`${focusClass} flex items-baseline gap-3 rounded-lg px-3 py-2 text-sm ${
                item.id === activeId ? "text-fg" : "text-fg-muted"
              }`}
            >
              <span className="font-mono text-[11px] tabular-nums text-fg-subtle">
                {String(i + 1).padStart(2, "0")}
              </span>
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </details>
  );
}