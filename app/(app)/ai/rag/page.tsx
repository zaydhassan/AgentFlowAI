"use client";

import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

const sources = [
  { id: "s1", name: "Product Docs (Confluence)", icon: "BookOpen", type: "confluence", color: "#3b82f6", chunks: 12480, status: "indexed" },
  { id: "s2", name: "Notion Workspace", icon: "FileText", type: "notion", color: "#f4f4f4", chunks: 6420, status: "indexed" },
  { id: "s3", name: "Google Drive / Contracts", icon: "HardDrive", type: "drive", color: "#22c55e", chunks: 3210, status: "indexed" },
  { id: "s4", name: "SharePoint / HR", icon: "FolderArchive", type: "sharepoint", color: "#0078d4", chunks: 8920, status: "indexing" },
  { id: "s5", name: "PDF Knowledge Base", icon: "Files", type: "pdf", color: "#e11d48", chunks: 5180, status: "indexed" },
];

const collections = [
  { name: "vector-embeddings", model: "text-embedding-3-large", dims: 3072, count: 36210 },
  { name: "agent-context", model: "voyage-3", dims: 1024, count: 12480 },
];

const queries = [
  { q: "What is our refund policy for annual plans?", top: "Refunds KB · §4.2", score: 0.94 },
  { q: "How do we onboard a new vendor?", top: "Procurement SOP · v3", score: 0.91 },
  { q: "Who handles enterprise escalations?", top: "Support Handbook · Escalation", score: 0.89 },
];

export default function RagPage() {
  return (
    <div className="animate-float-up">
      <PageHeader
        title="RAG Sources"
        description="Connect your documents and knowledge bases for retrieval-augmented generation."
        actions={<Button size="sm" variant="ai"><Icon name="Plus" className="h-3.5 w-3.5" /> Connect source</Button>}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader><CardTitle>Connected Sources</CardTitle><CardDescription>Indexed & ready for semantic search</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {sources.map((s) => (
              <div key={s.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${s.color}22`, color: s.color }}>
                  <Icon name={s.icon} className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{s.name}</div>
                  <div className="text-[11px] text-fg-subtle">{s.chunks.toLocaleString("en-US")} chunks · {s.type}</div>
                </div>
                <Badge tone={s.status === "indexed" ? "success" : "warning"}>
                  {s.status === "indexing" && <Icon name="LoaderCircle" className="mr-1 h-2.5 w-2.5 animate-spin" />}
                  {s.status}
                </Badge>
                <button className="grid h-7 w-7 place-items-center rounded-lg text-fg-subtle hover:bg-surface-3 hover:text-fg"><Icon name="MoreHorizontal" className="h-4 w-4" /></button>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Vector Collections</CardTitle><CardDescription>Embedding stores</CardDescription></CardHeader>
          <CardContent className="space-y-2">
            {collections.map((c) => (
              <div key={c.name} className="rounded-lg border border-border bg-surface-2/40 p-3">
                <div className="flex items-center gap-2">
                  <Icon name="Layers" className="h-4 w-4 text-ai" />
                  <span className="font-mono text-xs">{c.name}</span>
                </div>
                <div className="mt-1.5 text-[11px] text-fg-muted">{c.model} · {c.dims} dims</div>
                <div className="mt-2 h-1.5 w-full rounded-full bg-surface-3 overflow-hidden">
                  <div className="h-full w-[70%] rounded-full bg-gradient-to-r from-brand to-ai" />
                </div>
                <div className="mt-1 text-[10px] text-fg-subtle">{c.count.toLocaleString("en-US")} vectors</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader><CardTitle>Semantic Search</CardTitle><CardDescription>Recent retrieval queries & top results</CardDescription></CardHeader>
        <CardContent className="space-y-2">
          {queries.map((q, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2/40 p-3">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-soft text-brand"><Icon name="Search" className="h-3.5 w-3.5" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm">{q.q}</div>
                <div className="text-[11px] text-fg-subtle">→ {q.top}</div>
              </div>
              <Badge tone="success">{(q.score * 100).toFixed(0)}% match</Badge>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}