import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { prisma } from "@/lib/db";
import { workflowSummary } from "@/lib/workflow/graph";
import { createWorkflowForUser } from "@/lib/workflow/create";
import { cached } from "@/lib/cache";

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

  const wf = await createWorkflowForUser(user.id, body);

  return NextResponse.json({ id: wf.id }, { status: 201 });
}