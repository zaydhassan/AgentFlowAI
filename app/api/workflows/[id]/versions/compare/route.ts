// Compare two workflow versions: returns both versions' metadata + graphs and
// a server-computed structural diff (lib/workflow/diff). Keeps the diff logic off
// the client and avoids shipping both full graphs twice.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { diffGraphs } from "@/lib/workflow/diff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET ?from=N&to=M — structural diff between two saved versions.
// `from` is the older/baseline, `to` is the newer/target; either order works,
// the diff is just direction-aware (from→to).
export async function GET(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const url = new URL(req.url);
  const fromN = Number(url.searchParams.get("from"));
  const toN = Number(url.searchParams.get("to"));
  if (!Number.isFinite(fromN) || !Number.isFinite(toN)) {
    return NextResponse.json({ error: "from and to version numbers are required." }, { status: 400 });
  }
  if (fromN === toN) {
    return NextResponse.json({ error: "Select two different versions to compare." }, { status: 400 });
  }

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { ownerId: true, versions: { where: { version: { in: [fromN, toN] } } } },
  });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const byVer = new Map(wf.versions.map((v) => [v.version, v]));
  const a = byVer.get(fromN);
  const b = byVer.get(toN);
  if (!a || !b) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  const fromGraph = normalizeGraph(a.graph);
  const toGraph = normalizeGraph(b.graph);
  const diff = diffGraphs(fromGraph, toGraph);

  const meta = (v: typeof a) => ({
    version: v.version,
    message: v.message,
    author: v.createdBy,
    createdAt: v.createdAt.toISOString(),
  });

  return NextResponse.json({
    from: { ...meta(a), graph: fromGraph },
    to: { ...meta(b), graph: toGraph },
    diff,
  });
}