"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { NODE_LIBRARY, CATEGORY_META } from "@/lib/nodes";
import { cn } from "@/lib/utils";

const CANVAS = [
  { type: "group", label: "Group", icon: "SquareStack", category: "Canvas", desc: "Group nodes together" },
  { type: "sticky", label: "Sticky Note", icon: "StickyNote", category: "Canvas", desc: "Add a note" },
  { type: "comment", label: "Comment", icon: "MessageCircle", category: "Canvas", desc: "Annotate a node" },
];

export function NodeSearch({
  onClose,
  onPick,
}: {
  onClose: () => void;
  onPick: (type: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const results = useMemo(() => {
    const t = q.toLowerCase().trim();
    const lib = NODE_LIBRARY.map((n) => ({ type: n.type, label: n.label, icon: n.icon, category: CATEGORY_META[n.category].label, desc: n.description }));
    const all = [...CANVAS, ...lib];
    if (!t) return all.slice(0, 12);
    return all.filter((n) => n.label.toLowerCase().includes(t) || n.type.includes(t) || n.desc.toLowerCase().includes(t)).slice(0, 12);
  }, [q]);

  // `active` selection resets alongside `q` — done in the input onChange below
  // (the only place `q` changes), so no reset effect is needed.

  const pick = (type: string) => { onPick(type); onClose(); };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-items-center pt-[15vh]" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-[30rem] max-w-[90vw] overflow-hidden rounded-2xl border border-border bg-surface-2/95 backdrop-blur-2xl shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-border px-3 py-2.5">
          <Icon name="Search" className="h-4 w-4 text-fg-subtle" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setActive(0); }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => Math.min(a + 1, results.length - 1)); }
              else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
              else if (e.key === "Enter" && results[active]) { e.preventDefault(); pick(results[active].type); }
            }}
            placeholder="Search nodes to add to the canvas…"
            className="w-full bg-transparent text-sm focus:outline-none placeholder:text-fg-subtle"
          />
          <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-subtle">esc</kbd>
        </div>
        <div className="max-h-80 overflow-y-auto p-1.5">
          {results.length === 0 && <div className="px-3 py-6 text-center text-xs text-fg-subtle">No nodes match &ldquo;{q}&rdquo;.</div>}
          {results.map((n, i) => (
            <button
              key={n.type}
              onMouseEnter={() => setActive(i)}
              onClick={() => pick(n.type)}
              className={cn("flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left", i === active ? "bg-brand-soft" : "hover:bg-surface-3")}
            >
              <span className="grid h-7 w-7 place-items-center rounded-lg bg-surface-3 text-fg-muted">
                <Icon name={n.icon} className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium">{n.label}</div>
                <div className="truncate text-[10px] text-fg-subtle">{n.desc}</div>
              </div>
              <span className="text-[10px] text-fg-subtle">{n.category}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}