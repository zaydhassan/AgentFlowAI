"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

export function CodeBlock({
  code,
  language = "bash",
  filename,
  className,
}: {
  code: string;
  language?: string;
  filename?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard may be blocked (permissions / non-secure context) — fail quietly.
    }
  };

  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-surface-2/70",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
          <Icon name="Terminal" className="h-3.5 w-3.5" />
          {filename ?? language}
        </div>
        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-fg-subtle transition-colors hover:bg-surface-3 hover:text-fg focus-ring"
        >
          <Icon name={copied ? "Check" : "Copy"} className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="overflow-x-auto px-4 py-4 text-[13px] leading-relaxed">
        <code className="font-mono text-fg/90">{code}</code>
      </pre>
    </div>
  );
}