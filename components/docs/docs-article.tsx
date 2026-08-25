"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/docs/breadcrumbs";
import { DocsSidebar } from "@/components/docs/docs-sidebar";
import { TableOfContents } from "@/components/docs/table-of-contents";
import { docNeighbors, type DocMeta } from "@/lib/docs/navigation";

const DOT_TONE: Record<string, string> = {
  brand: "bg-brand",
  ai: "bg-ai",
  success: "bg-success",
  warning: "bg-warning",
};

export function DocsArticle({ meta, children }: { meta: DocMeta; children: React.ReactNode }) {
  const { prev, next } = docNeighbors(meta.slug);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-5 lg:px-8 py-12 lg:py-16">
      <div className="xl:grid xl:grid-cols-[16rem_minmax(0,1fr)_15rem] xl:gap-10">
        {/* Left sidebar — sticky on desktop, collapsible on mobile. */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pr-2 pb-8">
            <DocsSidebar />
          </div>
        </aside>

        {/* Mobile sidebar toggle (below lg). */}
        <div className="mb-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileNavOpen((v) => !v)}
            aria-expanded={mobileNavOpen}
            className="flex w-full items-center justify-between rounded-xl border border-border bg-surface-2/50 px-4 py-3 text-sm font-medium transition-colors hover:bg-surface-2 focus-ring"
          >
            <span className="flex items-center gap-2">
              <Icon name="BookOpen" className="h-4 w-4 text-brand" />
              Browse docs
            </span>
            <Icon
              name="ChevronDown"
              className={cn("h-4 w-4 text-fg-subtle transition-transform", mobileNavOpen && "rotate-180")}
            />
          </button>
          <AnimatePresence initial={false}>
            {mobileNavOpen && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-3 rounded-xl border border-border bg-surface-2/40 p-4">
                  <DocsSidebar onNavigate={() => setMobileNavOpen(false)} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Article body. */}
        <div className="min-w-0">
          <Breadcrumbs
            items={[
              { label: "Home", href: "/" },
              { label: "Documentation", href: "/docs" },
              { label: meta.category, href: "/docs" },
              { label: meta.title },
            ]}
          />

          {/* Hero. */}
          <header className="mb-10 border-b border-border pb-8">
            <div className="flex items-center gap-2.5">
              <span className={cn("h-2 w-2 rounded-full", DOT_TONE[meta.tone])} aria-hidden />
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-fg-subtle">
                {meta.category}
              </span>
            </div>
            <h1 className="mt-3 text-balance text-3xl font-bold tracking-tight sm:text-4xl">
              {meta.title}
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-fg-muted sm:text-lg">
              {meta.description}
            </p>
            <div className="mt-5 flex items-center gap-4 text-xs text-fg-subtle">
              <span className="inline-flex items-center gap-1.5">
                <Icon name="Clock" className="h-3.5 w-3.5" />
                {meta.readingTime} min read
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Icon name="BookOpen" className="h-3.5 w-3.5" />
                Updated for v1.0
              </span>
            </div>
          </header>

          {/* Body — sections with ids matching meta.sections. */}
          <article className="docs-prose">{children}</article>

          {/* Prev / next navigation. */}
          <nav
            aria-label="Pagination"
            className="mt-12 grid gap-4 border-t border-border pt-8 sm:grid-cols-2"
          >
            <DocPager dir="prev" doc={prev} />
            <DocPager dir="next" doc={next} />
          </nav>
        </div>

        {/* Right rail — sticky table of contents (xl+). */}
        <aside className="hidden xl:block">
          <div className="sticky top-24 max-h-[calc(100dvh-7rem)] overflow-y-auto pb-8">
            <TableOfContents sections={meta.sections} />
          </div>
        </aside>
      </div>
    </div>
  );
}

function DocPager({ dir, doc }: { dir: "prev" | "next"; doc: DocMeta }) {
  const isPrev = dir === "prev";
  return (
    <Link
      href={doc.href}
      className={cn(
        "group flex flex-col rounded-xl border border-border bg-surface-2/40 p-4 transition-colors hover:border-border-strong hover:bg-surface-2 focus-ring",
        isPrev ? "sm:order-1" : "sm:order-2 sm:text-right",
      )}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wider text-fg-subtle">
        {isPrev ? "← Previous" : "Next →"}
      </span>
      <span className="mt-1 text-sm font-medium text-fg transition-colors group-hover:text-brand">
        {doc.title}
      </span>
    </Link>
  );
}