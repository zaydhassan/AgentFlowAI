"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { Input, Textarea } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { cn, relativeTime } from "@/lib/utils";
import {
  listMemories,
  searchMemories,
  createMemory,
  deleteMemory,
  memoryStats,
  manageMemories,
  listCollections,
  createCollection,
  deleteCollection,
  type Memory,
  type MemoryCollection,
  type MemoryHit,
  type MemoryScope,
  type MemoryStats,
  type ManageResult,
} from "@/lib/memory/client";

type Tone = "brand" | "ai" | "success" | "warning" | "danger" | "info" | "neutral";

const SCOPE_META: Record<MemoryScope, { label: string; tone: Tone; icon: string }> = {
  short_term: { label: "Short-term", tone: "neutral", icon: "Clock" },
  conversation: { label: "Conversation", tone: "info", icon: "MessagesSquare" },
  long_term: { label: "Long-term", tone: "brand", icon: "Brain" },
  workflow: { label: "Workflow", tone: "ai", icon: "Workflow" },
  agent: { label: "Agent", tone: "warning", icon: "Bot" },
  workspace: { label: "Workspace", tone: "success", icon: "Building2" },
};

const SCOPES: MemoryScope[] = ["short_term", "conversation", "long_term", "workflow", "agent", "workspace"];
const IMPORTANCE: { label: string; value: number }[] = [
  { label: "Low", value: 0.3 },
  { label: "Medium", value: 0.6 },
  { label: "High", value: 0.8 },
  { label: "Critical", value: 1.0 },
];

function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

export function MemoryDashboard({
  initialMemories,
  initialStats,
  initialCollections,
  embeddingsConfigured,
}: {
  initialMemories: Memory[];
  initialStats: MemoryStats;
  initialCollections: MemoryCollection[];
  embeddingsConfigured: boolean;
}) {
  const [memories, setMemories] = useState<Memory[]>(initialMemories);
  const [stats, setStats] = useState<MemoryStats>(initialStats);
  const [collections, setCollections] = useState<MemoryCollection[]>(initialCollections);
  const [hits, setHits] = useState<MemoryHit[] | null>(null);
  const [query, setQuery] = useState("");
  const [searchScope, setSearchScope] = useState<MemoryScope>("long_term");
  const [searching, setSearching] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [newScope, setNewScope] = useState<MemoryScope>("long_term");
  const [newImportance, setNewImportance] = useState(0.6);
  const [newContent, setNewContent] = useState("");
  const [saving, setSaving] = useState(false);

  const [collName, setCollName] = useState("");
  const [collBusy, setCollBusy] = useState(false);

  const [managing, setManaging] = useState(false);

  async function runSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      setHits(null);
      return;
    }
    setSearching(true);
    try {
      const result = await searchMemories(q, { scope: searchScope, topK: 20, threshold: 0.5, hybrid: true });
      setHits(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }

  async function clearSearch() {
    setHits(null);
    setQuery("");
    try {
      setMemories(await listMemories({ limit: 50 }));
    } catch {
      /* keep existing list on refresh failure */
    }
  }

  async function removeMemory(id: string) {
    setDeleting(id);
    try {
      await deleteMemory(id);
      setMemories((m) => m.filter((x) => x.id !== id));
      if (hits) setHits((h) => (h ? h.filter((x) => x.memory.id !== id) : h));
      toast.success("Memory deleted.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not delete.");
    } finally {
      setDeleting(null);
    }
  }

  async function addMemory(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim()) return;
    setSaving(true);
    try {
      const m = await createMemory({ content: newContent, scope: newScope, importance: newImportance });
      setMemories((prev) => [m, ...prev]);
      setNewContent("");
      toast.success("Memory stored.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not store memory.");
    } finally {
      setSaving(false);
    }
  }

  async function addCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!collName.trim()) return;
    setCollBusy(true);
    try {
      const c = await createCollection(collName.trim());
      setCollections((prev) => [c, ...prev]);
      setCollName("");
      toast.success("Collection created.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create collection.");
    } finally {
      setCollBusy(false);
    }
  }

  async function removeCollection(id: string) {
    try {
      await deleteCollection(id);
      setCollections((prev) => prev.filter((c) => c.id !== id));
      toast.success("Collection removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove collection.");
    }
  }

  async function runMaintenance() {
    setManaging(true);
    try {
      const res: ManageResult = await manageMemories();
      toast.success(`Maintenance done — merged ${res.merged}, expired ${res.expired}, promoted ${res.promoted}.`);
      setStats(await memoryStats());
      setMemories(await listMemories({ limit: 50 }));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Maintenance failed.");
    } finally {
      setManaging(false);
    }
  }

  const rows: { memory: Memory; score?: number }[] = hits
    ? hits.map((h) => ({ memory: h.memory, score: h.score }))
    : memories.map((m) => ({ memory: m }));

  return (
    <div className="space-y-4">
      {!embeddingsConfigured && (
        <Card className="border-warning/40 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-3 text-sm text-warning">
            <Icon name="AlertTriangle" className="h-4 w-4 shrink-0" />
            <span>
              Embeddings not configured. Set <code className="font-mono">OPENAI_API_KEY</code> to enable memory
              retrieve/store. Memory-enabled AI nodes will log “memory disabled” and still respond.
            </span>
          </CardContent>
        </Card>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-fg-subtle">
            <Icon name="Brain" className="h-4 w-4 text-warning" />
            <span className="text-[11px] uppercase tracking-wider">Memories</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{stats.total.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-fg-subtle">
            <Icon name="TrendingUp" className="h-4 w-4 text-success" />
            <span className="text-[11px] uppercase tracking-wider">Recall rate</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{pct(stats.recallRate)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-fg-subtle">
            <Icon name="PenLine" className="h-4 w-4 text-brand" />
            <span className="text-[11px] uppercase tracking-wider">Writes</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{stats.writes.toLocaleString()}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-fg-subtle">
            <Icon name="Database" className="h-4 w-4 text-ai" />
            <span className="text-[11px] uppercase tracking-wider">Store size</span>
          </div>
          <div className="mt-2 text-2xl font-semibold tabular-nums">{formatBytes(stats.storeSizeBytes)}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Store + search */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-3">
            <div>
              <CardTitle>Memory Store</CardTitle>
              <CardDescription>
                {hits ? `${hits.length} semantic match${hits.length === 1 ? "" : "es"}` : `${memories.length} memories`}
              </CardDescription>
            </div>
            <form onSubmit={runSearch} className="flex items-center gap-2">
              <select
                value={searchScope}
                onChange={(e) => setSearchScope(e.target.value as MemoryScope)}
                className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-xs text-fg outline-none focus:border-brand"
              >
                {SCOPES.map((s) => (
                  <option key={s} value={s}>
                    {SCOPE_META[s].label}
                  </option>
                ))}
              </select>
              <div className="relative w-56">
                <Icon name="Search" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-fg-subtle" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Semantic search…"
                  className="pl-9"
                />
              </div>
              <Button type="submit" size="sm" variant="secondary" disabled={searching}>
                {searching ? "…" : "Search"}
              </Button>
              {hits && (
                <Button type="button" size="sm" variant="ghost" onClick={clearSearch}>
                  Clear
                </Button>
              )}
            </form>
          </CardHeader>
          <CardContent className="space-y-2">
            {rows.length === 0 && (
              <div className="py-8 text-center text-sm text-fg-subtle">
                {hits ? "No matches above the similarity threshold." : "No memories yet. Add one, or run a memory-enabled AI node."}
              </div>
            )}
            {rows.map(({ memory: m, score }) => {
              const meta = SCOPE_META[m.scope] ?? SCOPE_META.long_term;
              return (
                <div
                  key={m.id}
                  className="flex items-start gap-3 rounded-lg border border-border bg-surface-2/40 p-3"
                >
                  <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", `bg-surface-3 text-fg-subtle`)}>
                    <Icon name={meta.icon} className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={meta.tone}>{meta.label}</Badge>
                      {score != null && (
                        <Badge tone="ai">score {score.toFixed(2)}</Badge>
                      )}
                      <span className="text-[10px] text-fg-subtle">importance {m.importanceScore.toFixed(1)}</span>
                    </div>
                    <div className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-xs text-fg-muted">
                      {m.content}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-[10px] text-fg-subtle">
                      <span>{relativeTime(m.createdAt)}</span>
                      <span>{m.accessCount} access</span>
                      <span>{m.hitCount} hits</span>
                      {m.collection && <span>· {m.collection.name}</span>}
                    </div>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-fg-subtle hover:text-danger"
                    disabled={deleting === m.id}
                    onClick={() => removeMemory(m.id)}
                    aria-label="Delete memory"
                  >
                    <Icon name="Trash2" className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Right column: add memory + collections + maintenance */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Add memory</CardTitle>
              <CardDescription>Store a fact an agent should recall later.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={addMemory} className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={newScope}
                    onChange={(e) => setNewScope(e.target.value as MemoryScope)}
                    className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-xs text-fg outline-none focus:border-brand"
                  >
                    {SCOPES.map((s) => (
                      <option key={s} value={s}>
                        {SCOPE_META[s].label}
                      </option>
                    ))}
                  </select>
                  <select
                    value={newImportance}
                    onChange={(e) => setNewImportance(Number(e.target.value))}
                    className="h-9 rounded-lg border border-border bg-surface-2 px-2 text-xs text-fg outline-none focus:border-brand"
                  >
                    {IMPORTANCE.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>
                <Textarea
                  value={newContent}
                  onChange={(e) => setNewContent(e.target.value)}
                  placeholder="e.g. The customer prefers EUR invoices and PDF reports."
                  rows={3}
                  className="text-xs"
                />
                <Button type="submit" size="sm" variant="ai" disabled={saving || !newContent.trim()} className="w-full">
                  <Icon name="Plus" className="h-3.5 w-3.5" />
                  {saving ? "Storing…" : "Store memory"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Collections</CardTitle>
                <CardDescription>{collections.length} named group{collections.length === 1 ? "" : "s"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <form onSubmit={addCollection} className="flex gap-2">
                <Input
                  value={collName}
                  onChange={(e) => setCollName(e.target.value)}
                  placeholder="e.g. customer-faq"
                  className="text-xs"
                />
                <Button type="submit" size="sm" variant="secondary" disabled={collBusy || !collName.trim()}>
                  <Icon name="Plus" className="h-3.5 w-3.5" />
                </Button>
              </form>
              <div className="space-y-1.5">
                {collections.length === 0 && (
                  <div className="text-xs text-fg-subtle">No collections yet.</div>
                )}
                {collections.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-border bg-surface-2/40 p-2.5">
                    <Icon name="Folder" className="h-4 w-4 text-fg-subtle" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium text-fg">{c.name}</div>
                      <div className="text-[10px] text-fg-subtle">{c.memoryCount} memories</div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-fg-subtle hover:text-danger"
                      onClick={() => removeCollection(c.id)}
                      aria-label="Delete collection"
                    >
                      <Icon name="Trash2" className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <Button
                type="button"
                variant="secondary"
                className="w-full"
                disabled={managing}
                onClick={runMaintenance}
              >
                <Icon name="Wand2" className="h-4 w-4" />
                {managing ? "Running…" : "Run maintenance"}
              </Button>
              <p className="mt-2 text-[11px] text-fg-subtle">
                Dedup, merge near-duplicates, expire low-value, and promote frequently-recalled memories.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}