// Next-node recommendations given the selected node + graph. JSON.
import { NextResponse } from "next/server";
import { apiUser } from "@/lib/auth/api";
import { recommendNodes } from "@/lib/ai/provider";
import { normalizeGraph } from "@/lib/workflow/graph";
import type { WorkflowNode, WorkflowEdge } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(req: Request) {
  const u = await apiUser();
  if ("error" in u) return u.error;
  const { user } = u;
  void user;

  let body: { graph?: unknown; selectedType?: string } = {};
  try {
    body = (await req.json()) ?? {};
  } catch {
    body = {};
  }
  const graph = normalizeGraph(body.graph) as { nodes: WorkflowNode[]; edges: WorkflowEdge[] };
  const selectedType = typeof body.selectedType === "string" ? body.selectedType : null;

  const { nodes } = await recommendNodes(selectedType, graph);
  return NextResponse.json({ nodes });
}