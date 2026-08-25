import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string; v: string }> };

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
    version: {
      id: ver.id,
      version: ver.version,
      message: ver.message,
      author: ver.createdBy,
      createdAt: ver.createdAt.toISOString(),
      graph: normalizeGraph(ver.graph),
    },
  });
}

// POST ?action=restore — Git-style rollback. Instead of silently overwriting
// the working graph (lossy), this writes the target version's graph as a NEW
// head version (message "Restored from v{N}"), bumps Workflow.version, and sets
// the working graph to it. Every prior version is preserved and the rollback is
// itself a reversible, visible entry in history.
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
    select: { ownerId: true, version: true, versions: { where: { version }, take: 1 } },
  });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const ver = wf.versions[0];
  if (!ver) return NextResponse.json({ error: "Version not found." }, { status: 404 });

  const graph = normalizeGraph(ver.graph);
  const nextVersion = wf.version + 1;
  const message = `Restored from v${ver.version}`;

  const [head] = await prisma.$transaction([
    prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version: nextVersion,
        graph: graph as object,
        message,
        createdBy: user.email ?? user.id,
      },
    }),
    prisma.workflow.update({ where: { id }, data: { version: nextVersion, graph: graph as object } }),
  ]);

  return NextResponse.json({
    ok: true,
    graph,
    restoredFrom: ver.version,
    version: { id: head.id, version: head.version, message: head.message, author: head.createdBy, createdAt: head.createdAt.toISOString() },
  });
}