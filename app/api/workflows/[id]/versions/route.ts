// Workflow versions: list / save a named version from the current graph.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// GET — version list (id/version/message/createdAt), newest first.
export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const wf = await prisma.workflow.findUnique({
    where: { id },
    select: { ownerId: true, versions: { orderBy: { version: "desc" }, take: 100 } },
  });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  return NextResponse.json({
    versions: wf.versions.map((v) => ({
      id: v.id,
      version: v.version,
      message: v.message,
      createdAt: v.createdAt.toISOString(),
    })),
  });
}

// POST — snapshot the current graph as a named version; bumps Workflow.version.
export async function POST(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  let body: { message?: string; graph?: unknown } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const wf = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true, version: true, graph: true } });
  if (!wf || wf.ownerId !== user.id) return NextResponse.json({ error: "Not found." }, { status: 404 });

  const graph = normalizeGraph(body.graph ?? wf.graph);
  const nextVersion = wf.version + 1;

  const [version] = await prisma.$transaction([
    prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version: nextVersion,
        graph: graph as object,
        message: body.message?.trim().slice(0, 200) || null,
        createdBy: user.email ?? user.id,
      },
    }),
    prisma.workflow.update({ where: { id }, data: { version: nextVersion } }),
  ]);

  return NextResponse.json(
    {
      id: version.id,
      version: version.version,
      message: version.message,
      createdAt: version.createdAt.toISOString(),
    },
    { status: 201 },
  );
}