import "server-only";
import { prisma } from "@/lib/db";
import { cacheInvalidate } from "@/lib/cache";
import { EMPTY_GRAPH, normalizeGraph } from "@/lib/workflow/graph";
import { WORKFLOW_NAME_MAX, WORKFLOW_DESCRIPTION_MAX, WORKFLOW_TAGS_MAX } from "@/lib/workflow/limits";

export interface CreateWorkflowInput {
  name?: string;
  description?: string;
  category?: string;
  tags?: string[];
  /** Raw graph payload; coerced to a safe Graph via normalizeGraph. */
  graph?: unknown;
  status?: string;
}

/**
 * Create a workflow owned by `userId`. Single source of truth for the create
 * path — used by POST /api/workflows, GET /workflows/new, and the marketplace
 * install route so all three agree on graph normalization, field-length limits,
 * status handling, and per-user list-cache invalidation.
 */
export async function createWorkflowForUser(userId: string, input: CreateWorkflowInput) {
  const graph = normalizeGraph(input.graph ?? EMPTY_GRAPH);
  const name = (input.name?.trim() || "Untitled workflow").slice(0, WORKFLOW_NAME_MAX);

  const wf = await prisma.workflow.create({
    data: {
      ownerId: userId,
      name,
      description: input.description?.slice(0, WORKFLOW_DESCRIPTION_MAX) ?? "",
      category: input.category ?? "",
      tags: Array.isArray(input.tags) ? input.tags.slice(0, WORKFLOW_TAGS_MAX) : [],
      status: input.status === "active" ? "active" : "draft",
      graph: graph as object,
    },
  });

  // A new workflow changes the user's list projection — drop the cached list.
  await cacheInvalidate(`workflows:list:${userId}`);
  return wf;
}