import Link from "next/link";
import { Icon } from "@/components/ui/icon";

export type RelatedLink = { label: string; href: string; desc?: string; external?: boolean };

export function RelatedDocs({ links }: { links: RelatedLink[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {links.map((l) => (
        <Link
          key={l.href + l.label}
          href={l.href}
          {...(l.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
          className="group flex items-start gap-3 rounded-xl border border-border bg-surface-2/40 p-4 transition-colors hover:border-border-strong hover:bg-surface-2 focus-ring"
        >
          <Icon
            name={l.external ? "ExternalLink" : "ArrowRight"}
            className="mt-0.5 h-4 w-4 shrink-0 text-fg-subtle transition-colors group-hover:text-brand"
          />
          <span className="min-w-0">
            <span className="block text-sm font-medium text-fg transition-colors group-hover:text-brand">
              {l.label}
            </span>
            {l.desc && <span className="mt-0.5 block text-xs text-fg-muted">{l.desc}</span>}
          </span>
        </Link>
      ))}
    </div>
  );
}