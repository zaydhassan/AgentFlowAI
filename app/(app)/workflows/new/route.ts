import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/session";
import { createWorkflowForUser } from "@/lib/workflow/create";

export const dynamic = "force-dynamic";

// GET /workflows/new — create a blank workflow owned by the signed-in user
// and redirect to its builder. A GET so it works as a plain link/anchor.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?callbackUrl=/workflows");

  const wf = await createWorkflowForUser(user.id, {});

  redirect(`/workflows/${wf.id}`);
}