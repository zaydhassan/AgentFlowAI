"use client";

import { memo, useCallback } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";

type GroupData = {
  label?: string;
  group?: { label: string; color: string };
};

function GroupNodeComponent({ id, data, selected }: NodeProps) {
  const d = data as GroupData;
  const group = d.group ?? { label: "Group", color: "#64748b" };
  const rf = useReactFlow();

  const onLabel = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, group: { ...group, label: e.target.value } } } : n)),
      );
    },
    [rf, group, id],
  );

  return (
    <div
      className={cn(
        "h-full min-h-[140px] w-full rounded-xl border-2 border-dashed bg-surface-2/20 backdrop-blur-[2px]",
        selected ? "border-brand" : "",
      )}
      style={{ borderColor: selected ? undefined : `${group.color}66` }}
    >
      <div
        className="flex items-center gap-1.5 rounded-t-[10px] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest"
        style={{ color: group.color, background: `${group.color}14` }}
      >
        <span className="h-1.5 w-1.5 rounded-sm" style={{ background: group.color }} />
        <input
          value={group.label}
          onChange={onLabel}
          onPointerDown={(e) => e.stopPropagation()}
          className="w-28 bg-transparent text-[10px] uppercase tracking-widest focus:outline-none"
          style={{ color: group.color }}
        />
      </div>
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);