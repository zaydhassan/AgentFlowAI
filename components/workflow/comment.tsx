"use client";

import { memo, useCallback } from "react";
import { NodeProps, useReactFlow } from "@xyflow/react";
import { cn } from "@/lib/utils";

type CommentData = {
  label?: string;
  comment?: { content: string };
};

function CommentComponent({ id, data, selected }: NodeProps) {
  const d = data as CommentData;
  const content = d.comment?.content ?? "";
  const rf = useReactFlow();

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      rf.setNodes((nds) =>
        nds.map((n) => (n.id === id ? { ...n, data: { ...n.data, comment: { content: e.target.value } } } : n)),
      );
    },
    [rf, id],
  );

  return (
    <div className={cn("w-44 rounded-lg border border-info/40 bg-info/5 backdrop-blur-sm", selected && "ring-2 ring-brand")}>
      <div className="flex items-center gap-1 border-b border-info/30 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-info">
        <span className="h-1.5 w-1.5 rounded-full bg-info" /> Comment
      </div>
      <textarea
        value={content}
        onChange={onChange}
        placeholder="Add an annotation…"
        onPointerDown={(e) => e.stopPropagation()}
        className="w-44 h-16 resize-none bg-transparent px-2 py-1.5 text-[11px] leading-relaxed text-fg-muted placeholder:text-fg-subtle focus:outline-none"
      />
    </div>
  );
}

export const Comment = memo(CommentComponent);