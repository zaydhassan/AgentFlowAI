import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/db";
import { EMPTY_GRAPH } from "@/lib/workflow/graph";

export const dynamic = "force-dynamic";

// GET /workflows/new — create a blank workflow owned by the signed-in user
// and redirect to its builder. A GET so it works as a plain link/anchor.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/workflows");

  const wf = await prisma.workflow.create({
    data: { ownerId: user.id, name: "Untitled workflow", graph: EMPTY_GRAPH as object },
  });

  redirect(`/workflows/${wf.id}`);
}