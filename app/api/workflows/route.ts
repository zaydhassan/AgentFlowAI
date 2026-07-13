// Workflow collection: list mine / create.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { EMPTY_GRAPH, normalizeGraph, workflowSummary } from "@/lib/workflow/graph";
import { cached, cacheInvalidate } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// GET /api/workflows — list the signed-in user's workflows (slim projection).
// Cached as "workflow metadata": per-user, 60s TTL. Invalidated on create (the
// POST below), and on per-workflow update/delete (app/api/workflows/[id]/route.ts).
export async function GET() {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  const payload = await cached(`workflows:list:${user.id}`, 60, async () => ({
    workflows: (await prisma.workflow.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: "desc" },
    })).map(workflowSummary),
  }));
  return NextResponse.json(payload);
}

// POST /api/workflows — create a blank workflow (or seed from an AI plan / template).
export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  let body: {
    name?: string;
    description?: string;
    category?: string;
    tags?: string[];
    graph?: unknown;
    status?: string;
  } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const graph = normalizeGraph(body.graph ?? EMPTY_GRAPH);
  const name = body.name?.trim() || "Untitled workflow";

  const wf = await prisma.workflow.create({
    data: {
      ownerId: user.id,
      name: name.slice(0, 120),
      description: body.description?.slice(0, 2000) ?? "",
      category: body.category ?? "",
      tags: Array.isArray(body.tags) ? body.tags.slice(0, 20) : [],
      status: body.status === "active" ? "active" : "draft",
      graph: graph as object,
    },
  });

  // A new workflow changes the user's list projection — drop the cached list.
  await cacheInvalidate(`workflows:list:${user.id}`);
  return NextResponse.json({ id: wf.id }, { status: 201 });
}