"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NODE_LIBRARY, CATEGORY_META, CATEGORY_ORDER } from "@/lib/nodes";
import type { NodeCategory, NodeDef } from "@/lib/types";
import { cn } from "@/lib/utils";

// Canvas-only node types (not in the integration library). The builder maps
// these to dedicated custom React Flow node types (sticky / comment / group).
const CANVAS_NODES: { type: string; label: string; icon: string; description: string; color: string }[] = [
  { type: "group", label: "Group", icon: "SquareStack", description: "Group nodes together", color: "#64748b" },
  { type: "sticky", label: "Sticky Note", icon: "StickyNote", description: "Add a note", color: "#facc15" },
  { type: "comment", label: "Comment", icon: "MessageCircle", description: "Annotate a node", color: "#22d3ee" },
];

export function NodePalette({ onAISuggest }: { onAISuggest?: () => void }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return NODE_LIBRARY;
    return NODE_LIBRARY.filter(
      (n) => n.label.toLowerCase().includes(t) || n.type.includes(t) || n.description.toLowerCase().includes(t),
    );
  }, [q]);

  const byCat = useMemo(() => {
    const m = new Map<NodeCategory, NodeDef[]>();
    for (const n of filtered) {
      if (!m.has(n.category)) m.set(n.category, []);
      m.get(n.category)!.push(n);
    }
    return m;
  }, [filtered]);

  const onDragStart = (e: React.DragEvent, type: string) => {
    e.dataTransfer.setData("application/agentflow-node", type);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-3">
        <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-fg-subtle">Node Library</div>
        <div className="relative">
          <Icon name="Search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search 60+ nodes…" className="h-8 pl-8 text-xs" />
        </div>
        {onAISuggest && (
          <Button variant="ai" size="sm" className="mt-2 w-full" onClick={onAISuggest}>
            <Icon name="Sparkles" className="h-3.5 w-3.5" /> Build with AI
          </Button>
        )}
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {/* Canvas nodes */}
        <div>
          <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
            <Icon name="Shapes" className="h-3 w-3" /> Canvas
          </div>
          <div className="space-y-1">
            {CANVAS_NODES.map((n) => (
              <PaletteItem key={n.type} type={n.type} label={n.label} icon={n.icon} description={n.description} color={n.color} onDragStart={onDragStart} />
            ))}
          </div>
        </div>

        {/* Integration library by category */}
        {CATEGORY_ORDER.map((cat) => {
          const nodes = byCat.get(cat);
          if (!nodes || nodes.length === 0) return null;
          const meta = CATEGORY_META[cat];
          return (
            <div key={cat}>
              <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                <span className="h-2 w-2 rounded-sm" style={{ background: meta.color }} />
                {meta.label}
              </div>
              <div className="space-y-1">
                {nodes.map((n) => (
                  <PaletteItem key={n.type} type={n.type} label={n.label} icon={n.icon} description={n.description} color={n.color} onDragStart={onDragStart} />
                ))}
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-fg-subtle">No nodes match &ldquo;{q}&rdquo;.</div>
        )}
      </div>

      <div className="border-t border-border p-2.5 text-[10px] text-fg-subtle">
        Drag nodes onto the canvas · <kbd className="rounded border border-border bg-surface-3 px-1">⌘K</kbd> commands · <kbd className="rounded border border-border bg-surface-3 px-1">/</kbd> search
      </div>
    </div>
  );
}

function PaletteItem({
  type,
  label,
  icon,
  description,
  color,
  onDragStart,
}: {
  type: string;
  label: string;
  icon: string;
  description: string;
  color: string;
  onDragStart: (e: React.DragEvent, type: string) => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => onDragStart(e, type)}
      className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 transition-colors hover:border-border hover:bg-surface-2 active:cursor-grabbing"
    >
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg" style={{ background: `${color}22`, color }}>
        <Icon name={icon} className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0">
        <div className="truncate text-xs font-medium">{label}</div>
        <div className="truncate text-[10px] text-fg-subtle">{description}</div>
      </div>
    </div>
  );
}