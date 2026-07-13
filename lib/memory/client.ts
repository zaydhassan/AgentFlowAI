"use client";

// Client-safe memory helpers for the dashboard. The browser only ever lists,
// searches, creates, and deletes memories — it never sees the embedding
// vector (the server strips it). Re-exports the client-safe types for components.

import type {
  Memory,
  MemoryCollection,
  MemoryHit,
  MemoryScope,
  MemoryStats,
  ManageResult,
} from "./types";

export type { Memory, MemoryCollection, MemoryHit, MemoryScope, MemoryStats, ManageResult };

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `Request failed (${res.status}).`);
  }
  return (await res.json()) as T;
}

export async function listMemories(params?: {
  scope?: MemoryScope;
  workflowId?: string;
  collectionId?: string;
  q?: string;
  limit?: number;
}): Promise<Memory[]> {
  const url = new URL("/api/memory", window.location.origin);
  if (params?.scope) url.searchParams.set("scope", params.scope);
  if (params?.workflowId) url.searchParams.set("workflowId", params.workflowId);
  if (params?.collectionId) url.searchParams.set("collectionId", params.collectionId);
  if (params?.q) url.searchParams.set("q", params.q);
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  return json<{ memories: Memory[] }>(await fetch(url, { cache: "no-store" })).then((d) => d.memories);
}

export async function searchMemories(query: string, opts?: {
  scope?: MemoryScope;
  topK?: number;
  threshold?: number;
  hybrid?: boolean;
}): Promise<MemoryHit[]> {
  return json<{ hits: MemoryHit[] }>(
    await fetch("/api/memory/search", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, scope: opts?.scope, topK: opts?.topK, threshold: opts?.threshold, hybrid: opts?.hybrid }),
    }),
  ).then((d) => d.hits);
}

export async function createMemory(input: {
  content: string;
  scope: MemoryScope;
  importance?: number;
  collectionId?: string;
  metadata?: Record<string, unknown>;
}): Promise<Memory> {
  return json<Memory>(
    await fetch("/api/memory", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}

export async function deleteMemory(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/memory/${id}`, { method: "DELETE" }));
}

export async function memoryStats(): Promise<MemoryStats> {
  return json<MemoryStats>(await fetch("/api/memory/stats", { cache: "no-store" }));
}

export async function manageMemories(): Promise<ManageResult> {
  return json<ManageResult>(await fetch("/api/memory/manage", { method: "POST" }));
}

export async function listCollections(): Promise<MemoryCollection[]> {
  return json<{ collections: MemoryCollection[] }>(
    await fetch("/api/memory/collections", { cache: "no-store" }),
  ).then((d) => d.collections);
}

export async function createCollection(name: string, description?: string): Promise<MemoryCollection> {
  return json<MemoryCollection>(
    await fetch("/api/memory/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description }),
    }),
  );
}

export async function deleteCollection(id: string): Promise<void> {
  await json<{ ok: true }>(await fetch(`/api/memory/collections/${id}`, { method: "DELETE" }));
}