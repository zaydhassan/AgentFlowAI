"use client";

import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface EmptyStateSpec {
  icon: string;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCta?: () => void;
}

export function EmptyState({
  icon,
  title,
  description,
  ctaLabel,
  onCta,
  compact = false,
  className,
}: EmptyStateSpec & { compact?: boolean; className?: string }) {
  return (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center text-center",
        compact ? "gap-1.5 py-1" : "gap-2.5 p-4",
        className,
      )}
    >
      <div
        className={cn(
          "grid place-items-center rounded-full border border-border bg-surface-2 text-brand",
          compact ? "h-9 w-9" : "h-12 w-12",
        )}
      >
        <Icon name={icon} className={cn(compact ? "h-4 w-4" : "h-5 w-5")} />
      </div>
      <div className={cn("font-medium text-fg", compact ? "text-xs" : "text-sm")}>{title}</div>
      {description && (
        <div
          className={cn(
            "text-fg-muted leading-snug",
            compact ? "text-[10px] max-w-[15rem]" : "text-xs max-w-xs",
          )}
        >
          {description}
        </div>
      )}
      {ctaLabel && onCta && (
        <Button
          variant="outline"
          size="sm"
          onClick={onCta}
          className={cn("mt-1", compact && "h-7 px-2 text-[11px]")}
        >
          <Icon name="Plus" className="h-3.5 w-3.5" />
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}