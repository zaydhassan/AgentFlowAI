// Architecture diagram placeholder — a clean, labelled layered diagram built
// from divs (no SVG/Chart dependency). Each "layer" is a row of one or more
// nodes; a downward chevron sits between layers to imply flow.
//
// This is intentionally a tasteful placeholder (the requirement asks for an
// "architecture diagram placeholder") — not an empty box. The diagram is driven
// by data so each article can render its own structure without bespoke JSX.

import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { ConceptTone } from "@/components/marketing/core-concept-card";

type DiagramNode = { label: string; sub?: string; tone?: ConceptTone };

const NODE_TONE: Record<ConceptTone, string> = {
  brand: "border-brand/30 text-brand",
  ai: "border-ai/30 text-ai",
  success: "border-success/30 text-success",
  warning: "border-warning/30 text-warning",
};

export function ArchitectureDiagram({
  layers,
  caption,
}: {
  layers: DiagramNode[][];
  caption?: string;
}) {
  return (
    <figure className="my-8 overflow-hidden rounded-2xl border border-border bg-surface-2/40 p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-fg-subtle">
        <Icon name="Network" className="h-3.5 w-3.5" />
        Architecture
      </div>

      <div className="flex flex-col items-stretch gap-3">
        {layers.map((row, ri) => (
          <div key={ri}>
            <div
              className={cn(
                "grid gap-3",
                row.length === 1 ? "grid-cols-1" : row.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3",
              )}
            >
              {row.map((node, ni) => (
                <div
                  key={ni}
                  className={cn(
                    "rounded-xl border bg-surface-2 px-4 py-3 text-center",
                    node.tone ? NODE_TONE[node.tone] : "border-border",
                  )}
                >
                  <div className="text-sm font-semibold text-fg">{node.label}</div>
                  {node.sub && <div className="mt-0.5 text-xs text-fg-muted">{node.sub}</div>}
                </div>
              ))}
            </div>
            {ri < layers.length - 1 && (
              <div className="my-1 flex justify-center" aria-hidden>
                <Icon name="ArrowDown" className="h-4 w-4 text-fg-subtle" />
              </div>
            )}
          </div>
        ))}
      </div>

      {caption && (
        <figcaption className="mt-5 text-center text-xs text-fg-subtle">{caption}</figcaption>
      )}
    </figure>
  );
}