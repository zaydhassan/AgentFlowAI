"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { Input } from "@/components/ui/input";
import { NODE_LIBRARY, CATEGORY_META } from "@/lib/nodes";
import { cn } from "@/lib/utils";

export function NodePalette() {
  const [q, setQ] = useState("");
  const filtered = useMemo(() => {
    const t = q.toLowerCase().trim();
    if (!t) return NODE_LIBRARY;
    return NODE_LIBRARY.filter(
      (n) => n.label.toLowerCase().includes(t) || n.type.includes(t) || n.description.toLowerCase().includes(t)
    );
  }, [q]);

  const byCat = useMemo(() => {
    const m = new Map<string, typeof NODE_LIBRARY>();
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
      <div className="p-3 border-b border-border">
        <div className="text-xs font-semibold uppercase tracking-widest text-fg-subtle mb-2">Node Library</div>
        <div className="relative">
          <Icon name="Search" className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search nodes…" className="h-8 pl-8 text-xs" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {Array.from(byCat.entries()).map(([cat, nodes]) => (
          <div key={cat}>
            <div className="flex items-center gap-1.5 px-1.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
              <span className="h-2 w-2 rounded-sm" style={{ background: CATEGORY_META[cat]?.color }} />
              {CATEGORY_META[cat]?.label ?? cat}
            </div>
            <div className="space-y-1">
              {nodes.map((n) => (
                <div
                  key={n.type}
                  draggable
                  onDragStart={(e) => onDragStart(e, n.type)}
                  className="group flex cursor-grab items-center gap-2.5 rounded-lg border border-transparent px-2 py-1.5 hover:border-border hover:bg-surface-2 active:cursor-grabbing"
                >
                  <span
                    className="grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                    style={{ background: `${n.color}22`, color: n.color }}
                  >
                    <Icon name={n.icon} className="h-3.5 w-3.5" />
                  </span>
                  <div className="min-w-0">
                    <div className="truncate text-xs font-medium">{n.label}</div>
                    <div className="truncate text-[10px] text-fg-subtle">{n.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="px-3 py-8 text-center text-xs text-fg-subtle">No nodes match “{q}”.</div>
        )}
      </div>
      <div className={cn("border-t border-border p-2.5 text-[10px] text-fg-subtle")}>
        Tip: drag nodes onto the canvas · press <kbd className="rounded border border-border bg-surface-3 px-1">⌘K</kbd> for commands
      </div>
    </div>
  );
}