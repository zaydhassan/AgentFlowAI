import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { isPaidUser } from "@/lib/auth/session";
import { templates } from "@/lib/mock/data";
import { EMPTY_GRAPH } from "@/lib/workflow/graph";
import { createWorkflowForUser } from "@/lib/workflow/create";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// POST /api/marketplace/install — install a marketplace template for the
// signed-in user. Paid-only: the marketplace page gates the UI, and this route
// enforces the same plan check on the server (defense in depth). Templates are
// metadata-only today, so this creates a draft workflow seeded with the
// template's name/description/category/tags and an empty graph, then the client
// opens it in the builder to add nodes.
export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;

  if (!isPaidUser(user)) {
    return NextResponse.json(
      { error: "Marketplace is a premium feature. Upgrade to install templates." },
      { status: 402 },
    );
  }

  let body: { templateId?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }

  const tpl = templates.find((t) => t.id === body.templateId);
  if (!tpl) {
    return NextResponse.json({ error: "Template not found." }, { status: 404 });
  }

  const wf = await createWorkflowForUser(user.id, {
    name: tpl.name,
    description: tpl.description,
    category: tpl.category,
    tags: tpl.tags,
    status: "draft",
    graph: EMPTY_GRAPH,
  });

  return NextResponse.json({ id: wf.id }, { status: 201 });
}