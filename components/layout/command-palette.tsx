"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface Cmd {
  id: string;
  label: string;
  hint?: string;
  icon: string;
  group: string;
  action: () => void;
}

export function CommandPalette({
  open,
  onClose,
  onOpenCommand,
}: {
  open: boolean;
  onClose: () => void;
  onOpenCommand: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);

  const go = (href: string) => () => {
    router.push(href);
    onClose();
  };

  const commands: Cmd[] = useMemo(
    () => [
      { id: "c1", label: "Dashboard", icon: "LayoutDashboard", group: "Navigate", action: go("/dashboard") },
      { id: "c2", label: "Workflows", icon: "Workflow", group: "Navigate", action: go("/workflows") },
      { id: "c3", label: "Executions", icon: "Activity", group: "Navigate", action: go("/executions") },
      { id: "c4", label: "Observability", icon: "LineChart", group: "Navigate", action: go("/observability") },
      { id: "c5", label: "AI Copilot", icon: "Sparkles", group: "Navigate", action: go("/ai") },
      { id: "c6", label: "Agents", icon: "Bot", group: "Navigate", action: go("/ai/agents") },
      { id: "c7", label: "Memory", icon: "Brain", group: "Navigate", action: go("/ai/memory") },
      { id: "c8", label: "RAG Sources", icon: "Library", group: "Navigate", action: go("/ai/rag") },
      { id: "c9", label: "Marketplace", icon: "Store", group: "Navigate", action: go("/marketplace") },
      { id: "c10", label: "Settings", icon: "Settings", group: "Navigate", action: go("/settings") },
      { id: "c11", label: "Billing", icon: "CreditCard", group: "Navigate", action: go("/settings/billing") },
      { id: "c12", label: "New Workflow", icon: "Plus", group: "Create", action: go("/workflows/new") },
      { id: "c13", label: "Build from natural language", icon: "Wand2", group: "Create", action: go("/ai") },
      { id: "c14", label: "Open Invoice Processing", icon: "FileText", group: "Workflows", action: go("/workflows/wf_invoice") },
      { id: "c15", label: "Open Lead Generation", icon: "UserPlus", group: "Workflows", action: go("/workflows/wf_leadgen") },
      { id: "c16", label: "Open AI Email Assistant", icon: "Mail", group: "Workflows", action: go("/workflows/wf_email") },
      { id: "c17", label: "Documentation", icon: "BookOpen", group: "Help", action: () => onClose() },
      { id: "c18", label: "Keyboard shortcuts", icon: "Keyboard", group: "Help", action: () => onClose() },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q) || c.group.toLowerCase().includes(q));
  }, [query, commands]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  useEffect(() => setActive((a) => Math.min(a, Math.max(filtered.length - 1, 0))), [filtered.length]);

  // global hotkey handled by parent; arrow + enter here
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, filtered.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter" && filtered[active]) {
        e.preventDefault();
        filtered[active].action();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, filtered, active]);

  if (!open) return null;

  const grouped = filtered.reduce<Record<string, Cmd[]>>((acc, c) => {
    (acc[c.group] ??= []).push(c);
    return acc;
  }, {});
  let flatIdx = -1;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-2/95 backdrop-blur-2xl shadow-2xl shadow-black/60 animate-float-up">
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon name="Search" className="h-4 w-4 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a command or search…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
          />
          <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-muted">esc</kbd>
        </div>
        <div className="max-h-[50vh] overflow-y-auto p-2">
          {filtered.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-fg-subtle">No results for “{query}”</div>
          )}
          {Object.entries(grouped).map(([group, cmds]) => (
            <div key={group} className="mb-1">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">{group}</div>
              {cmds.map((c) => {
                flatIdx++;
                const isActive = flatIdx === active;
                return (
                  <button
                    key={c.id}
                    onMouseEnter={() => setActive(flatIdx)}
                    onClick={c.action}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors",
                      isActive ? "bg-brand-soft text-fg" : "text-fg-muted hover:text-fg"
                    )}
                  >
                    <Icon
                      name={c.icon}
                      className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-fg-subtle")}
                    />
                    <span className="flex-1 text-left">{c.label}</span>
                    {isActive && <Icon name="CornerDownLeft" className="h-3.5 w-3.5 text-fg-subtle" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[10px] text-fg-subtle">
          <span className="flex items-center gap-1"><Icon name="ArrowUp" className="h-3 w-3" /> navigate</span>
          <span className="flex items-center gap-1"><Icon name="CornerDownLeft" className="h-3 w-3" /> select</span>
          <span className="ml-auto">AgentFlow AI</span>
        </div>
      </div>
    </div>
  );
}