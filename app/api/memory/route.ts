import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { memoryEngine, repository, resolveOrgId, type MemoryScope } from "@/lib/memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES: MemoryScope[] = ["short_term", "conversation", "long_term", "workflow", "agent", "workspace"];

function parseScope(v: string | null): MemoryScope | undefined {
  return v && SCOPES.includes(v as MemoryScope) ? (v as MemoryScope) : undefined;
}

export async function GET(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const url = new URL(req.url);
  const scope = parseScope(url.searchParams.get("scope"));
  const workflowId = url.searchParams.get("workflowId");
  const collectionId = url.searchParams.get("collectionId");
  const q = url.searchParams.get("q");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50) || 50, 200);

  // `q` triggers a semantic search (returns the matched Memory rows, no scores).
  if (q && q.trim()) {
    const result = await memoryEngine.recall({
      userId: user.id,
      orgId: await resolveOrgId(user.id),
      scope: scope ?? "long_term",
      query: q,
      workflowId: workflowId ?? null,
      topK: limit,
      threshold: 0.5,
      hybrid: true,
    });
    return NextResponse.json({ memories: result.hits.map((h) => h.memory) });
  }

  const memories = await repository.list({
    ownerId: user.id,
    scope,
    workflowId: workflowId ?? undefined,
    collectionId: collectionId ?? undefined,
    limit,
  });
  return NextResponse.json({ memories });
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: {
    content?: string;
    scope?: MemoryScope;
    importance?: number;
    collectionId?: string;
    metadata?: Record<string, unknown>;
  } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  if (!body.content || !body.content.trim()) {
    return NextResponse.json({ error: "content is required." }, { status: 400 });
  }
  const scope: MemoryScope =
    body.scope && SCOPES.includes(body.scope) ? body.scope : "long_term";

  const res = await memoryEngine.remember({
    userId: user.id,
    orgId: await resolveOrgId(user.id),
    scope,
    content: body.content,
    importance: typeof body.importance === "number" ? body.importance : 0.5,
    collectionId: body.collectionId ?? null,
    metadata: body.metadata,
  });

  if (!res.memory) {
    return NextResponse.json(
      { error: "Embeddings not configured. Set OPENAI_API_KEY to store memories." },
      { status: 503 },
    );
  }
  return NextResponse.json(res.memory);
}