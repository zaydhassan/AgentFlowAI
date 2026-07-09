import type { Metadata } from "next";
import { MarketingPage } from "@/components/marketing/page-shell";
import { Badge } from "@/components/ui/badge";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Changelog — AgentFlow AI",
  description: "Release notes for AgentFlow AI — what shipped, what changed, and what's next.",
};

type Entry = {
  version: string;
  date: string;
  tag: "Released" | "Improved" | "Fixed";
  tone: "brand" | "ai" | "success";
  notes: { kind: "New" | "Improved" | "Fixed"; body: string }[];
};

const entries: Entry[] = [
  {
    version: "1.0.0",
    date: "July 9, 2026",
    tag: "Released",
    tone: "brand",
    notes: [
      { kind: "New", body: "Visual workflow builder with 60+ nodes and live graph execution." },
      { kind: "New", body: "AI agents with persistent memory, tools, and RAG — invoked as first-class nodes." },
      { kind: "New", body: "Self-healing runs: automatic retries, timeouts, and step-level recovery." },
      { kind: "New", body: "Per-workspace secrets vault with scoped integration tokens." },
      { kind: "New", body: "Execution observability: per-node latency, cost, and input/output inspection." },
      { kind: "New", body: "Credit-based billing with Free, Pro, Business, and Enterprise plans." },
    ],
  },
  {
    version: "0.9.2",
    date: "June 2026",
    tag: "Improved",
    tone: "ai",
    notes: [
      { kind: "Improved", body: "Agent memory lookups are now ~3x faster via indexed retrieval." },
      { kind: "Improved", body: "Workflow canvas supports copy/paste and multi-select wiring." },
      { kind: "Fixed", body: "Scheduled triggers no longer drift across DST boundaries." },
    ],
  },
  {
    version: "0.9.0",
    date: "May 2026",
    tag: "Improved",
    tone: "ai",
    notes: [
      { kind: "New", body: "Self-healing execution engine with automatic step retries." },
      { kind: "New", body: "Audit log export for Business workspaces." },
      { kind: "Fixed", body: "OAuth nodes now correctly refresh expired tokens mid-run." },
    ],
  },
  {
    version: "0.8.0",
    date: "April 2026",
    tag: "Improved",
    tone: "ai",
    notes: [
      { kind: "New", body: "Persistent agent memory and retrieval (RAG) nodes." },
      { kind: "Improved", body: "Runtime isolation per tenant with resource limits." },
    ],
  },
];

const toneByKind: Record<Entry["notes"][number]["kind"], "brand" | "ai" | "success"> = {
  New: "brand",
  Improved: "ai",
  Fixed: "success",
};

export default function ChangelogPage() {
  return (
    <MarketingPage>
      <section className="relative mesh-bg overflow-hidden">
        <div className="relative mx-auto max-w-3xl px-5 lg:px-8 py-24 text-center">
          <Badge tone="ai" className="mx-auto mb-5">Changelog</Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight sm:text-5xl">Release notes</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-fg-muted">
            What shipped, what changed, and what we fixed. The current platform version is{" "}
            <span className="font-medium text-fg">v{site.version}</span>.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-3xl px-5 lg:px-8 pb-24">
        <ol className="relative border-l border-border pl-6 space-y-10">
          {entries.map((e, i) => (
            <li key={e.version} className="relative">
              <span
                className="absolute -left-[31px] top-1 grid h-3 w-3 place-items-center rounded-full bg-brand ring-4 ring-bg"
                aria-hidden
              />
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-semibold tracking-tight">v{e.version}</h2>
                <Badge tone={e.tone}>{e.tag}</Badge>
                <span className="text-xs text-fg-subtle">{e.date}</span>
                {i === 0 && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success/10 px-2 py-0.5 text-[11px] font-medium text-success">
                    <span className="h-1.5 w-1.5 rounded-full bg-success" aria-hidden /> Latest
                  </span>
                )}
              </div>
              <ul className="mt-4 space-y-2.5">
                {e.notes.map((n, j) => (
                  <li key={j} className="flex items-start gap-2.5 text-sm">
                    <Badge tone={toneByKind[n.kind]} className="mt-0.5 shrink-0">{n.kind}</Badge>
                    <span className="text-fg-muted">{n.body}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>

        <div className="mt-12 rounded-2xl border border-border bg-surface-2/40 p-6 text-sm text-fg-muted">
          Earlier releases predate the public changelog. Want a deeper look at where we&apos;re
          headed? See the <a href="/about" className="text-brand hover:underline">roadmap</a>.
        </div>
      </section>
    </MarketingPage>
  );
}