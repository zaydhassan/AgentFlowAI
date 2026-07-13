"use client";

import { useEffect, useRef } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export interface ContextAction {
  key: string;
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
  divider?: boolean;
}

export function ContextMenu({
  x,
  y,
  actions,
  onClose,
}: {
  x: number;
  y: number;
  actions: ContextAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("mousedown", onDown); window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  // keep on screen
  const left = Math.min(x, window.innerWidth - 200);
  const top = Math.min(y, window.innerHeight - (actions.length * 32 + 12));

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-surface-2/95 backdrop-blur-xl p-1 shadow-2xl"
      style={{ left, top }}
    >
      {actions.map((a) => (
        <div key={a.key}>
          {a.divider && <div className="my-1 h-px bg-border" />}
          <button
            onClick={() => { a.onClick(); onClose(); }}
            className={cn("flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs hover:bg-surface-3", a.danger ? "text-danger" : "text-fg")}
          >
            <Icon name={a.icon} className="h-3.5 w-3.5" />
            {a.label}
          </button>
        </div>
      ))}
    </div>
  );
}