"use client";

// AgentFlow command palette — a productivity surface modelled on Linear /
// Cursor / Notion / VS Code, NOT a duplicate of the sidebar.
//
// Result priority (highest → lowest):
//   ⚡ Actions → 📁 Workflows → 🤖 Agents → 🧠 Memory → ▶️ Executions →
//   🔌 Integrations → 📚 Documentation → 🧭 Navigation
//
// Behaviour:
//  - Empty query: Quick Actions + recently opened items (no navigation).
//  - Typed query: fuzzy-matched results grouped by priority. Sidebar/nav
//    items only surface when they actually match the query, and they always
//    render last as a fallback — they never crowd out real content.
//  - Selection runs the item's action (navigate / execute / open flow) and
//    records it into localStorage so it resurfaces in the empty state.
//  - Full keyboard control: ↑/↓ move, ↵ select, esc close.

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { fuzzyMatchFields } from "@/lib/fuzzy";
import { workflows, executions } from "@/lib/mock/data";
import { docArticles } from "@/lib/docs/navigation";
import { connectProvider } from "@/lib/integrations/client";

type GroupId =
  | "recent"
  | "actions"
  | "workflows"
  | "agents"
  | "memory"
  | "executions"
  | "integrations"
  | "documentation"
  | "navigation";

interface PaletteItem {
  id: string;
  title: string;
  description?: string;
  icon: string;
  group: GroupId;
  /** Right-aligned keyboard hint, e.g. "create", "open", "↵". */
  hint?: string;
  /** Extra searchable text (tags, category, synonyms). */
  keywords?: string;
  action: () => void;
}

// Display order = priority order. `recent` is a synthetic empty-state group.
const GROUPS: { id: GroupId; label: string; emoji: string }[] = [
  { id: "recent", label: "Recent", emoji: "🕑" },
  { id: "actions", label: "Actions", emoji: "⚡" },
  { id: "workflows", label: "Workflows", emoji: "📁" },
  { id: "agents", label: "Agents", emoji: "🤖" },
  { id: "memory", label: "Memory", emoji: "🧠" },
  { id: "executions", label: "Executions", emoji: "▶️" },
  { id: "integrations", label: "Integrations", emoji: "🔌" },
  { id: "documentation", label: "Documentation", emoji: "📚" },
  { id: "navigation", label: "Navigation", emoji: "🧭" },
];

const GROUP_RANK: Record<GroupId, number> = Object.fromEntries(
  GROUPS.map((g, i) => [g.id, i]),
) as Record<GroupId, number>;

// ─────────────────────────── static catalogs ────────────────────────────────
// Workflows + executions come from the mock store (the same source the list
// pages render), docs come from the docs nav model, and agents/integrations/
// navigation are small static catalogs. When these move to live API data the
// palette follows automatically for the dynamic ones.

const AGENTS = [
  { id: "agent_planner", name: "Planner", icon: "Workflow", desc: "Breaks requests into subtasks and estimates cost & time." },
  { id: "agent_research", name: "Research", icon: "Search", desc: "Browses the web, reads docs, summarizes, extracts." },
  { id: "agent_router", name: "AI Router", icon: "Route", desc: "Routes each task to the optimal model by cost & latency." },
  { id: "agent_memory", name: "Memory", icon: "Brain", desc: "Stores history, preferences, and long-term context." },
];

const INTEGRATIONS = [
  { id: "int_gmail", name: "Gmail Integration", icon: "Mail", desc: "Send, search, and trigger on email." },
];

const INTEGRATION_NODES = [
  { id: "int_gmail_send", name: "Gmail Send", icon: "Send", desc: "Action node — send an email." },
  { id: "int_gmail_search", name: "Gmail Search", icon: "Search", desc: "Action node — search the inbox." },
  { id: "int_gmail_trigger", name: "Gmail Trigger", icon: "Webhook", desc: "Trigger node — fires on a new email." },
];

// Leftover sidebar routes that don't belong to a content group above. The
// Agents and Memory routes are intentionally NOT here — they live in their
// content groups ("Agents Dashboard", "Memory Dashboard") to avoid duplication.
const NAV_ITEMS = [
  { id: "nav_dashboard", title: "Dashboard", icon: "LayoutDashboard", href: "/dashboard" },
  { id: "nav_workflows", title: "Workflows", icon: "Workflow", href: "/workflows" },
  { id: "nav_executions", title: "Executions", icon: "Activity", href: "/executions" },
  { id: "nav_observability", title: "Observability", icon: "LineChart", href: "/observability" },
  { id: "nav_copilot", title: "AI Copilot", icon: "Sparkles", href: "/ai" },
  { id: "nav_rag", title: "RAG Sources", icon: "Library", href: "/ai/rag" },
  { id: "nav_marketplace", title: "Marketplace", icon: "Store", href: "/marketplace" },
  { id: "nav_settings", title: "Settings", icon: "Settings", href: "/settings" },
  { id: "nav_billing", title: "Billing", icon: "CreditCard", href: "/settings/billing" },
];

const RECENT_KEY = "agentflow:cmd-recent";
const RECENT_MAX = 6;

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
  /** Reserved for callers that want to re-arm the palette from inside it. */
  onOpenCommand?: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recentIds, setRecentIds] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  // True when the active row last moved via keyboard (or a new query), false
  // when it moved via hover. We only scrollIntoView on keyboard moves —
  // otherwise wheel-scrolling the list moves content under the cursor, firing
  // onMouseEnter on new rows, which would snap the scroll back and fight the
  // wheel (the "mouse scroll does nothing" bug).
  const keyboardNavRef = useRef(false);

  const go = (href: string) => () => {
    router.push(href);
    onClose();
  };

  // Create a workflow via the API (same path the topbar uses) and jump into
  // the builder. /workflows/new is a POST-only route handler with no page, so
  // we POST and redirect to the new id instead.
  const createWorkflow = () => {
    fetch("/api/workflows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    })
      .then(async (res) => {
        if (res.status === 401) {
          router.push("/login?callbackUrl=/workflows");
          return;
        }
        if (res.ok) {
          const { id } = await res.json();
          if (id) router.push(`/workflows/${id}`);
        }
      })
      .catch(() => {})
      .finally(() => onClose());
  };

  const connectGmail = () => {
    connectProvider("gmail", { returnUrl: "/settings/integrations" })
      .catch(() => {})
      .finally(() => onClose());
  };

  // ─────────────────────────── all palette items ────────────────────────────
  const allItems = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      { id: "qa_new_workflow", title: "New Workflow", icon: "Plus", group: "actions", hint: "create", description: "Create a blank workflow and open the builder.", keywords: "create new workflow build blank", action: createWorkflow },
      { id: "qa_new_agent", title: "New Agent", icon: "Bot", group: "actions", hint: "new", description: "Open the agents workspace.", keywords: "create new agent", action: go("/ai/agents") },
      { id: "qa_run_workflow", title: "Run Workflow", icon: "Play", group: "actions", hint: "run", description: "Pick a workflow to execute.", keywords: "run execute start workflow", action: go("/workflows") },
      { id: "qa_marketplace", title: "Open Marketplace", icon: "Store", group: "actions", hint: "open", description: "Browse and install templates.", keywords: "marketplace templates install", action: go("/marketplace") },
      { id: "qa_connect_gmail", title: "Connect Gmail", icon: "Mail", group: "actions", hint: "connect", description: "Start the Gmail OAuth flow.", keywords: "connect gmail integration oauth google", action: connectGmail },
      { id: "qa_build_prompt", title: "Build from prompt", icon: "Wand2", group: "actions", hint: "build", description: "Describe a workflow in natural language.", keywords: "build prompt natural language ai copilot generate", action: go("/ai") },
    ];

    const wfItems: PaletteItem[] = workflows.map((w) => ({
      id: `wf_${w.id}`,
      title: w.name,
      description: w.description,
      icon: "Workflow",
      group: "workflows",
      hint: "open",
      keywords: `workflow ${w.category} ${(w.tags ?? []).join(" ")} ${w.status}`,
      action: go(`/workflows/${w.id}`),
    }));

    const agentItems: PaletteItem[] = [
      {
        id: "agents_dashboard",
        title: "Agents Dashboard",
        icon: "Bot",
        group: "agents",
        hint: "open",
        description: "Overview of your autonomous AI workforce.",
        keywords: "agents dashboard overview",
        action: go("/ai/agents"),
      },
      ...AGENTS.map((a) => ({
        id: a.id,
        title: `${a.name} Agent`,
        description: a.desc,
        icon: a.icon,
        group: "agents" as GroupId,
        hint: "open",
        keywords: `agent ${a.name}`,
        action: go("/ai/agents"),
      })),
    ];

    const memoryItems: PaletteItem[] = [
      { id: "mem_dashboard", title: "Memory Dashboard", icon: "Brain", group: "memory", hint: "open", description: "Long-term memory across runs, agents, and workflows.", keywords: "memory dashboard long-term context", action: go("/ai/memory") },
      { id: "mem_create", title: "Create Memory", icon: "Plus", group: "memory", hint: "new", description: "Add a long-term memory entry.", keywords: "create new add memory", action: go("/ai/memory") },
      { id: "mem_docs", title: "Memory Documentation", icon: "BookOpen", group: "memory", hint: "read", description: "How agents store and recall context (RAG).", keywords: "memory docs documentation rag retrieval", action: go("/docs/agents") },
    ];

    const execItems: PaletteItem[] = executions.map((e) => ({
      id: `ex_${e.id}`,
      title: `${e.workflowName} — ${e.id}`,
      description: `${e.status} · ${e.trigger} trigger`,
      icon: "Activity",
      group: "executions",
      hint: "open",
      keywords: `execution run ${e.workflowName} ${e.status} ${e.trigger}`,
      action: go(`/executions/${e.id}`),
    }));

    const integrationItems: PaletteItem[] = [
      ...INTEGRATIONS.map((i) => ({
        id: i.id,
        title: i.name,
        description: i.desc,
        icon: i.icon,
        group: "integrations" as GroupId,
        hint: "open",
        keywords: "integration connect gmail google",
        action: go("/settings/integrations"),
      })),
      ...INTEGRATION_NODES.map((n) => ({
        id: n.id,
        title: n.name,
        description: n.desc,
        icon: n.icon,
        group: "integrations" as GroupId,
        hint: "node",
        keywords: "node gmail trigger action send search",
        action: go("/docs/workflows"),
      })),
      {
        id: "int_gmail_docs",
        title: "Gmail Documentation",
        icon: "BookOpen",
        group: "integrations" as GroupId,
        hint: "read",
        description: "Connecting Gmail and using its nodes.",
        keywords: "gmail documentation docs integration",
        action: go("/docs/integrations"),
      },
    ];

    const docItems: PaletteItem[] = docArticles.map((d) => ({
      id: `doc_${d.slug}`,
      title: d.title,
      description: d.description,
      icon: d.icon,
      group: "documentation",
      hint: "read",
      keywords: `docs documentation ${d.category}`,
      action: go(d.href),
    }));

    const navItems: PaletteItem[] = NAV_ITEMS.map((n) => ({
      id: n.id,
      title: n.title,
      icon: n.icon,
      group: "navigation",
      description: "Open this page",
      keywords: `${n.title} navigate page`,
      action: go(n.href),
    }));

    return [
      ...actions,
      ...wfItems,
      ...agentItems,
      ...memoryItems,
      ...execItems,
      ...integrationItems,
      ...docItems,
      ...navItems,
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  // ─────────────────────────── filtering + ranking ──────────────────────────
  const results = useMemo<PaletteItem[]>(() => {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    const scored: { item: PaletteItem; score: number }[] = [];
    for (const item of allItems) {
      const score = fuzzyMatchFields(q, [
        item.title,
        item.description ?? "",
        item.keywords ?? "",
        item.group,
      ]);
      if (score !== null) scored.push({ item, score });
    }
    // Sort by relevance first, then re-sort by group priority (stable, so
    // within-group relevance order is preserved).
    scored.sort((a, b) => b.score - a.score);
    scored.sort((a, b) => GROUP_RANK[a.item.group] - GROUP_RANK[b.item.group]);

    // Navigation is a fallback: drop it entirely when higher-priority groups
    // already matched, so the sidebar never duplicates real content. It only
    // survives when the user explicitly searched for a nav destination.
    const hasNonNav = scored.some((s) => s.item.group !== "navigation");
    return scored
      .filter((s) => s.item.group !== "navigation" || !hasNonNav)
      .map((s) => s.item);
  }, [query, allItems]);

  // ─────────────────────────── empty-state items ────────────────────────────
  // Recent (if any) first, then the Quick Actions — no navigation.
  const emptyItems = useMemo<PaletteItem[]>(() => {
    if (!hydrated) return [];
    const recent = recentIds
      .map((id) => allItems.find((i) => i.id === id))
      .filter((x): x is PaletteItem => Boolean(x))
      .map((i) => ({ ...i, group: "recent" as GroupId }));
    const quick = allItems.filter((i) => i.group === "actions");
    // De-dup: a quick action that's also recent should only show once.
    const seen = new Set<string>();
    const out: PaletteItem[] = [];
    for (const i of [...recent, ...quick]) {
      if (seen.has(i.id)) continue;
      seen.add(i.id);
      out.push(i);
    }
    return out;
  }, [hydrated, recentIds, allItems]);

  const display = query.trim() ? results : emptyItems;

  // Group while preserving priority order.
  const grouped = useMemo(() => {
    const buckets = new Map<GroupId, PaletteItem[]>();
    for (const item of display) {
      const arr = buckets.get(item.group) ?? [];
      arr.push(item);
      buckets.set(item.group, arr);
    }
    return GROUPS.filter((g) => buckets.has(g.id)).map((g) => ({
      group: g,
      items: buckets.get(g.id)!,
    }));
  }, [display]);

  // Reset query + selection whenever the palette opens; hydrate recent ids.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    try {
      const raw = localStorage.getItem(RECENT_KEY);
      setRecentIds(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecentIds([]);
    }
    setHydrated(true);
  }, [open]);

  // Active index, clamped to the current result set. Derived (not set in an
  // effect) so we never hold a stale selection when results shrink.
  const safeActive = Math.min(active, Math.max(display.length - 1, 0));

  const recordRecent = (id: string) => {
    setRecentIds((prev) => {
      const next = [id, ...prev.filter((x) => x !== id)].slice(0, RECENT_MAX);
      try {
        localStorage.setItem(RECENT_KEY, JSON.stringify(next));
      } catch {
        /* ignore quota / privacy mode */
      }
      return next;
    });
  };

  const runItem = (item: PaletteItem) => {
    recordRecent(item.id);
    item.action();
  };

  // Keyboard navigation: ↑/↓ move, ↵ select, esc close.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        keyboardNavRef.current = true;
        setActive((a) => Math.min(a + 1, display.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        keyboardNavRef.current = true;
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const item = display[safeActive];
        if (item) runItem(item);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, display, safeActive]);

  // Scroll the active row into view — but ONLY for keyboard/query-driven
  // selection changes. Hover-driven changes must not scroll, or wheeling the
  // list fights the user (rows entering under the cursor would snap scroll).
  useEffect(() => {
    if (!keyboardNavRef.current) return;
    const root = listRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`[data-idx="${safeActive}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [safeActive, display]);

  // Lock background scroll while the palette is open so the wheel only ever
  // scrolls the results list (never the page behind the backdrop).
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  let flatIdx = -1;
  const hasQuery = query.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl overflow-hidden rounded-2xl border border-border bg-surface-2/95 backdrop-blur-2xl shadow-2xl shadow-black/60 animate-float-up">
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4">
          <Icon name="Search" className="h-4 w-4 text-fg-subtle" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
              // New query → jump to the top result and bring it into view.
              keyboardNavRef.current = true;
            }}
            placeholder="Type a command or search workflows, agents, docs…"
            className="h-12 flex-1 bg-transparent text-sm text-fg placeholder:text-fg-subtle outline-none"
          />
          <kbd className="rounded border border-border bg-surface-3 px-1.5 py-0.5 text-[10px] text-fg-muted">esc</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {display.length === 0 && (
            <div className="px-3 py-10 text-center text-sm text-fg-subtle">
              {hasQuery ? (
                <>No results for “{query}”</>
              ) : (
                <>Start typing to search, or pick a quick action below.</>
              )}
            </div>
          )}

          {grouped.map(({ group, items }) => (
            <div key={group.id} className="mb-1.5">
              <div className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-fg-subtle">
                <span aria-hidden>{group.emoji}</span>
                {group.label}
              </div>
              {items.map((c) => {
                flatIdx++;
                const isActive = flatIdx === safeActive;
                return (
                  <button
                    key={c.id}
                    data-idx={flatIdx}
                    onMouseEnter={() => {
                      keyboardNavRef.current = false;
                      setActive(flatIdx);
                    }}
                    onClick={() => runItem(c)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm transition-colors",
                      isActive ? "bg-brand-soft text-fg" : "text-fg-muted hover:text-fg",
                    )}
                  >
                    <Icon
                      name={c.icon}
                      className={cn("h-4 w-4 shrink-0", isActive ? "text-brand" : "text-fg-subtle")}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-fg">{c.title}</span>
                      {c.description && (
                        <span className="block truncate text-[11px] text-fg-subtle">{c.description}</span>
                      )}
                    </span>
                    {c.hint && (
                      <kbd
                        className={cn(
                          "shrink-0 rounded border px-1.5 py-0.5 text-[9px] uppercase tracking-wide",
                          isActive ? "border-brand/40 bg-brand-soft/60 text-brand" : "border-border bg-surface-3 text-fg-subtle",
                        )}
                      >
                        {c.hint}
                      </kbd>
                    )}
                    {isActive && <Icon name="CornerDownLeft" className="h-3.5 w-3.5 shrink-0 text-fg-subtle" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        {/* Footer / keyboard legend */}
        <div className="flex items-center gap-4 border-t border-border px-3 py-2 text-[10px] text-fg-subtle">
          <span className="flex items-center gap-1"><Icon name="ArrowUp" className="h-3 w-3" /> navigate</span>
          <span className="flex items-center gap-1"><Icon name="CornerDownLeft" className="h-3 w-3" /> select</span>
          <span className="flex items-center gap-1"><Icon name="Keyboard" className="h-3 w-3" /> esc to close</span>
          <span className="ml-auto">AgentFlow AI</span>
        </div>
      </div>
    </div>
  );
}