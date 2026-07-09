// Data Access Layer (DAL) for the current user. Centralizes auth checks so
// pages and server actions don't each need their own. Wrapped in React's
// `cache` to dedupe within a render pass.

import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";

export const getCurrentUser = cache(async () => {
  const session = await auth();
  if (!session?.user?.id) return null;
  // The JWT is the source of truth for identity; do a single DB fetch here
  // for the fields the UI needs (avatar, plan, etc.).
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      image: true,
      role: true,
      stripeCustomerId: true,
      subscription: {
        select: {
          plan: true,
          status: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
        },
      },
    },
  });
  return user;
});

/**
 * Require an authenticated user. Redirects to /login if no session.
 * Use in server components and server actions.
 */
export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
