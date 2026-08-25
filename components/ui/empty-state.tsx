"use client";

import type { ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

// Honest empty state for a section that has no data yet. Mirrors what a real
// SaaS shows before any records exist: an icon, a one-line title, optional
// description, and an optional primary action (kept as a visual CTA). Used by
// the Settings tabs that aren't yet wired to live data so the UI communicates
// the intended feature without impersonating real users/orgs.
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-surface-2/30 px-6 py-12 text-center">
      <div className="grid h-11 w-11 place-items-center rounded-full bg-surface-3 text-fg-subtle">
        <Icon name={icon} className="h-5 w-5" />
      </div>
      <div className="space-y-1">
        <div className="text-sm font-medium text-fg">{title}</div>
        {description ? <div className="text-xs text-fg-subtle">{description}</div> : null}
      </div>
      {action}
    </div>
  );
}