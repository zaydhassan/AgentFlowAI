// Single workflow: fetch / auto-save / delete.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { cached, cacheDel, cacheInvalidate } from "@/lib/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

// Fetch one workflow (must be owned by the caller). Returns graph + meta.
// Cached as "workflow metadata": per-id, 90s TTL. `null` is cached for misses
// (ids are UUIDs, so a not-found id won't collide with a future workflow);
// ownership is re-checked inside the loader on every miss. Invalidated on
// PATCH/DELETE below.
export async function GET(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const payload = await cached<{ workflow: Record<string, unknown> } | null>(
    `workflow:${id}`,
    90,
    async () => {
      const wf = await prisma.workflow.findUnique({
        where: { id },
        include: {
          versions: { orderBy: { version: "desc" }, take: 50 },
          _count: { select: { executions: true } },
        },
      });
      if (!wf || wf.ownerId !== user.id) return null;
      return {
        workflow: {
          id: wf.id,
          name: wf.name,
          description: wf.description,
          status: wf.status,
          category: wf.category,
          tags: wf.tags,
          version: wf.version,
          schedule: wf.schedule,
          lastRunAt: wf.lastRunAt?.toISOString() ?? null,
          createdAt: wf.createdAt.toISOString(),
          updatedAt: wf.updatedAt.toISOString(),
          graph: normalizeGraph(wf.graph),
          executions: wf._count.executions,
          versions: wf.versions.map((v) => ({
            id: v.id,
            version: v.version,
            message: v.message,
            author: v.createdBy,
            createdAt: v.createdAt.toISOString(),
          })),
        },
      };
    },
  );

  if (!payload) return NextResponse.json({ error: "Not found." }, { status: 404 });
  return NextResponse.json(payload);
}

// PATCH — auto-save. Updates graph/name/status/viewport WITHOUT bumping version.
export async function PATCH(req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  let body: {
    name?: string;
    description?: string;
    status?: string;
    category?: string;
    tags?: string[];
    graph?: unknown;
  } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  // Ownership check before write.
  const existing = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (typeof body.name === "string") data.name = body.name.trim().slice(0, 120) || "Untitled workflow";
  if (typeof body.description === "string") data.description = body.description.slice(0, 2000);
  if (body.status === "active" || body.status === "draft" || body.status === "paused" || body.status === "error") data.status = body.status;
  if (typeof body.category === "string") data.category = body.category;
  if (Array.isArray(body.tags)) data.tags = body.tags.slice(0, 20);
  if (body.graph !== undefined) data.graph = normalizeGraph(body.graph) as object;

  const wf = await prisma.workflow.update({ where: { id }, data });
  // Drop the cached single-workflow projection AND the owner's list (updatedAt
  // ordering changes). Both are recomputed lazily on the next read.
  await cacheDel(`workflow:${id}`);
  await cacheInvalidate(`workflows:list:${user.id}`);
  return NextResponse.json({
    id: wf.id,
    updatedAt: wf.updatedAt.toISOString(),
    version: wf.version,
  });
}

// DELETE — remove a workflow (cascades to versions/executions/steps).
export async function DELETE(_req: Request, { params }: Params) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  const { id } = await params;

  const existing = await prisma.workflow.findUnique({ where: { id }, select: { ownerId: true } });
  if (!existing || existing.ownerId !== user.id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  await prisma.workflow.delete({ where: { id } });
  // Invalidate both projections on delete.
  await cacheDel(`workflow:${id}`);
  await cacheInvalidate(`workflows:list:${user.id}`);
  return NextResponse.json({ ok: true });
}