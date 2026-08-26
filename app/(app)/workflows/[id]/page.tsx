import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { normalizeGraph } from "@/lib/workflow/graph";
import { templates } from "@/lib/mock/data";
import Builder, { type InitialWorkflow } from "./builder";

export const dynamic = "force-dynamic";

export default async function WorkflowBuilderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/workflows");

  const { id } = await params;
  const { template: templateName } = await searchParams;

  const wf = await prisma.workflow.findUnique({
    where: { id },
    include: {
      versions: { orderBy: { version: "desc" }, take: 100 },
      _count: { select: { executions: true } },
    },
  });

  if (!wf || wf.ownerId !== user.id) redirect("/workflows");

  // When arriving from the marketplace, `?template=<name>` carries the template
  // origin so the builder can show a tailored empty-state. Looked up from the
  // mock catalog; falls back to undefined (generic empty-state) if not found.
  const templateOrigin = templateName
    ? (() => {
        const tpl = templates.find((t) => t.name === templateName);
        return tpl ? { name: tpl.name, description: tpl.description } : undefined;
      })()
    : undefined;

  const initial: InitialWorkflow = {
    id: wf.id,
    name: wf.name,
    description: wf.description,
    status: wf.status,
    version: wf.version,
    graph: normalizeGraph(wf.graph),
    versions: wf.versions.map((v) => ({ id: v.id, version: v.version, message: v.message, author: v.createdBy, createdAt: v.createdAt.toISOString() })),
    ...(templateOrigin ? { templateOrigin } : {}),
  };

  return <Builder initial={initial} />;
}