"use client";

// Documentation landing-page search. Client-side filtering over the article
// set (title, category, description). No external dependency — the docs corpus
// is small enough that filtering in the browser is instant and reliable.
//
// Empty query → render nothing (the category grid below already shows
// everything). Non-empty → a results list of article links; "no results" gets a
// quiet empty state with a link back to all docs.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { docArticles } from "@/lib/docs/navigation";

const DOT_TONE: Record<string, string> = {
  brand: "bg-brand",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
};

export function DocsSearch() {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null; // null = "not searching"; show the category grid instead.
    return docArticles.filter((a) =>
      [a.title, a.category, a.description].some((f) => f.toLowerCase().includes(q)),
    );
  }, [query]);

  return (
    <div className="mx-auto mt-8 max-w-xl">
      <label className="relative block">
        <span className="sr-only">Search documentation</span>
        <Icon
          name="Search"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle"
        />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search documentation…"
          className="w-full rounded-xl border border-border bg-surface-2/60 py-3 pl-10 pr-4 text-sm text-fg placeholder:text-fg-subtle transition-colors focus:border-brand/50 focus:bg-surface-2 focus:outline-none focus:ring-2 focus:ring-brand/30"
        />
      </label>

      {results && (
        <div className="mt-3 overflow-hidden rounded-xl border border-border bg-surface-2/50">
          {results.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-5 text-sm text-fg-muted">
              <Icon name="SearchX" className="h-4 w-4 text-fg-subtle" />
              No results for &ldquo;{query}&rdquo;.
              <Link href="/docs" className="ml-auto text-brand hover:underline" onClick={() => setQuery("")}>
                Clear
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {results.map((a) => (
                <li key={a.href}>
                  <Link
                    href={a.href}
                    className="group flex items-start gap-3 px-4 py-3 transition-colors hover:bg-surface-3"
                  >
                    <span
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", DOT_TONE[a.tone])}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="text-sm font-medium text-fg transition-colors group-hover:text-brand">
                          {a.title}
                        </span>
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-fg-subtle">
                          {a.category}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-fg-muted">
                        {a.description}
                      </span>
                    </span>
                    <Icon
                      name="ArrowRight"
                      className="mt-1 h-4 w-4 shrink-0 text-fg-subtle transition-all group-hover:translate-x-0.5 group-hover:text-brand"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}