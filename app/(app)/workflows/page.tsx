import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { workflowSummary, type WorkflowSummary } from "@/lib/workflow/graph";
import { WorkflowsList } from "@/components/workflow/workflows-list";

export const dynamic = "force-dynamic";

export default async function WorkflowsPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/workflows");

  const rows = await prisma.workflow.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
  });
  const workflows = rows.map(workflowSummary);

  return <WorkflowsList workflows={workflows} />;
}