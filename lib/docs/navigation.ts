import type { ConceptTone } from "@/components/marketing/core-concept-card";

export type DocSection = { id: string; title: string };

export type DocMeta = {
  slug: string;
  href: string;
  title: string;
  category: string;
  description: string;
  icon: string;
  tone: ConceptTone;
  /** Estimated reading time in minutes (200 wpm). */
  readingTime: number;
  /** Table of contents — ids must match <section id> in the page body. */
  sections: DocSection[];
};

export type DocCategory = {
  title: string;
  items: DocMeta[];
};

// Article order = prev/next order across the whole docs set.
export const docArticles: DocMeta[] = [
  {
    slug: "workflows",
    href: "/docs/workflows",
    title: "Workflows & Nodes",
    category: "AI Orchestration",
    description:
      "A workflow is a graph of typed nodes. Learn the node lifecycle, triggers, branching, and how outputs flow between steps.",
    icon: "Workflow",
    tone: "brand",
    readingTime: 11,
    sections: [
      { id: "overview", title: "Overview" },
      { id: "architecture", title: "Architecture" },
      { id: "key-concepts", title: "Key concepts" },
      { id: "code-examples", title: "Code examples" },
      { id: "best-practices", title: "Best practices" },
      { id: "related", title: "Related documentation" },
    ],
  },
  {
    slug: "agents",
    href: "/docs/agents",
    title: "Agents & Memory",
    category: "Intelligence Layer",
    description:
      "Invoke LLM-backed agents as nodes. Wire tools, persistent memory, and retrieval (RAG) into a single observable run.",
    icon: "BrainCircuit",
    tone: "ai",
    readingTime: 12,
    sections: [
      { id: "overview", title: "Overview" },
      { id: "architecture", title: "Architecture" },
      { id: "key-concepts", title: "Key concepts" },
      { id: "code-examples", title: "Code examples" },
      { id: "best-practices", title: "Best practices" },
      { id: "related", title: "Related documentation" },
    ],
  },
  {
    slug: "execution",
    href: "/docs/execution",
    title: "Execution & Self-healing",
    category: "Runtime",
    description:
      "Understand the scheduler, retries, timeouts, and how runs recover from transient failures automatically.",
    icon: "Activity",
    tone: "success",
    readingTime: 10,
    sections: [
      { id: "overview", title: "Overview" },
      { id: "architecture", title: "Architecture" },
      { id: "key-concepts", title: "Key concepts" },
      { id: "code-examples", title: "Code examples" },
      { id: "best-practices", title: "Best practices" },
      { id: "related", title: "Related documentation" },
    ],
  },
  {
    slug: "integrations",
    href: "/docs/integrations",
    title: "Secrets & Integrations",
    category: "Trust & Access",
    description:
      "Store scoped credentials per workspace and connect the 60+ built-in integrations through a managed, encrypted vault.",
    icon: "KeyRound",
    tone: "warning",
    readingTime: 9,
    sections: [
      { id: "overview", title: "Overview" },
      { id: "architecture", title: "Architecture" },
      { id: "key-concepts", title: "Key concepts" },
      { id: "code-examples", title: "Code examples" },
      { id: "best-practices", title: "Best practices" },
      { id: "related", title: "Related documentation" },
    ],
  },
];

// Grouped for the sidebar + landing category grid.
export const docNav: DocCategory[] = [
  {
    title: "AI Orchestration",
    items: [docArticles[0]],
  },
  {
    title: "Intelligence Layer",
    items: [docArticles[1]],
  },
  {
    title: "Runtime",
    items: [docArticles[2]],
  },
  {
    title: "Trust & Access",
    items: [docArticles[3]],
  },
];

export function getDocBySlug(slug: string): DocMeta | undefined {
  return docArticles.find((a) => a.slug === slug);
}

export function getDocByHref(href: string): DocMeta | undefined {
  return docArticles.find((a) => a.href === href);
}

// Prev/next across the flat article order (wraps at the ends so navigation
// never dead-ends).
export function docNeighbors(slug: string): { prev: DocMeta; next: DocMeta } {
  const i = docArticles.findIndex((a) => a.slug === slug);
  const safe = docArticles.length > 0 ? docArticles : [];
  const prevIdx = (i - 1 + safe.length) % safe.length;
  const nextIdx = (i + 1) % safe.length;
  return { prev: safe[prevIdx], next: safe[nextIdx] };
}