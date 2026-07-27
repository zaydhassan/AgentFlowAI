// Documentation breadcrumbs — server component. Renders
// Home / Documentation / <Category> / <Title>, with the current page as plain
// text (no self-link) and the rest as real routes.

import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export type Crumb = { label: string; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-1.5 text-[13px] text-fg-subtle">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.label} className="flex items-center gap-1.5">
              {i === 0 && <Icon name="Home" className="h-3.5 w-3.5" />}
              {c.href && !last ? (
                <Link href={c.href} className="transition-colors hover:text-fg">
                  {c.label}
                </Link>
              ) : (
                <span className={last ? "text-fg-muted" : ""}>{c.label}</span>
              )}
              {!last && <Icon name="ChevronRight" className="h-3 w-3 text-fg-subtle/70" />}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}