"use client";

import { memo, useCallback } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";

type StickyData = {
  label?: string;
  sticky?: { content: string; color: string };
};

function StickyNoteComponent({ id, data, selected }: NodeProps) {
  const d = data as StickyData;
  const sticky = d.sticky ?? { content: "", color: "#facc15" };
  const rf = useReactFlow();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, sticky: { ...sticky, content: e.target.value } } } : n)),
      );
    },
    [rf, sticky, id],
  );

  return (
    <div
      className={cn(
        "w-48 rounded-sm shadow-lg rotate-[-0.5deg] transition-shadow",
        selected && "ring-2 ring-brand",
      )}
      style={{ background: sticky.color }}
    >
      <div
        className="h-1.5 rounded-t-sm"
        style={{ background: "rgba(0,0,0,0.18)" }}
      />
      <textarea
        value={sticky.content}
        onChange={onChange}
        placeholder="Note…"
        onPointerDown={(e) => e.stopPropagation()}
        className="w-48 h-32 resize-none bg-transparent px-3 py-2 text-xs leading-relaxed text-black/80 placeholder:text-black/40 focus:outline-none"
        style={{ background: "transparent" }}
      />
    </div>
  );
}

export const StickyNote = memo(StickyNoteComponent);