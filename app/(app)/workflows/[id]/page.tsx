import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import Builder, { type InitialWorkflow } from "./builder";

export const dynamic = "force-dynamic";

export default async function WorkflowBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/workflows");

  const { id } = await params;

  const wf = await prisma.workflow.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" }, take: 100 },
      _count: { select: { executions: true } },
    },
  });

  if (!wf || wf.ownerId !== user.id) redirect("/workflows");

  const initial: InitialWorkflow = {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    status: wf.status,
    version: wf.version,
    graph: normalizeGraph(wf.graph),
    versions: wf.versions.map((v) => ({ id: v.id, version: v.version, message: v.message, author: v.createdBy, createdAt: v.createdAt.toISOString() })),
  };

  return <Builder initial={initial} />;
}