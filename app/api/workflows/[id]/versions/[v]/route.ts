// Single workflow version: fetch / restore.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; v: string }> };

// GET — one version's graph.
export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id, v } = await params;

  const version = Number(v);
  if (!Number.isFinite(version)) return NextResponse.json({ error: "Bad version." }, { status: 400 });

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { ownerId: true, versions: { where: { version }, take: 1 } },
  });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ver = wf.versions[0];
  if (!ver) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  return NextResponse.json({
    version: { id: ver.id, version: ver.version, message: ver.message, createdAt: ver.createdAt.toISOString(), graph: normalizeGraph(ver.graph) },
  });
}

// POST ?action=restore — copy a version's graph back onto the workflow (auto-save, no version bump).
export async function POST(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id, v } = await params;

  const url = new URL(req.url);
  if (url.searchParams.get("action") !== "restore") {
    return NextResponse.json({ error: "Unsupported action." }, { status: 400 });
  }

  const version = Number(v);
  if (!Number.isFinite(version)) return NextResponse.json({ error: "Bad version." }, { status: 400 });

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { ownerId: true, versions: { where: { version }, take: 1 } },
  });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ver = wf.versions[0];
  if (!ver) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  const graph = normalizeGraph(ver.graph);
  await prisma.workflow.update({ where: { id }, data: { graph: graph as object } });
  return NextResponse.json({ ok: true, graph, restoredFrom: ver.version });
}