import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { memoryEngine, resolveOrgId, type MemoryScope } from "@/lib/memory";
import { cached } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SCOPES: MemoryScope[] = ["short_term", "conversation", "long_term", "workflow", "agent", "workspace"];

// FNV-1a 32-bit hash of the query string → compact, stable cache key. (A raw
// query could be long; the hash keeps keys short without importing node:crypto.)
function hashQuery(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16);
}

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: {
    query?: string;
    scope?: MemoryScope;
    topK?: number;
    threshold?: number;
    hybrid?: boolean;
  } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  if (!body.query || !body.query.trim()) {
    return NextResponse.json({ error: "query is required." }, { status: 400 });
  }

  const scope = body.scope && SCOPES.includes(body.scope) ? body.scope : "long_term";
  const topK = typeof body.topK === "number" ? Math.min(body.topK, 50) : 5;
  const threshold = typeof body.threshold === "number" ? body.threshold : 0.75;
  const hybrid = body.hybrid ?? true;
  const key = `memory:search:${user.id}:${scope}:${topK}:${threshold}:${hybrid}:${hashQuery(body.query)}`;

  const payload = await cached(key, 30, async () => ({
    hits: (await memoryEngine.recall({
      userId: user.id,
      orgId: await resolveOrgId(user.id),
      scope,
      query: body.query!,
      topK,
      threshold,
      hybrid,
    })).hits,
  }));
  return NextResponse.json(payload);
}