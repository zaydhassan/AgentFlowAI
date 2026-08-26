import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { PAID_PLANS } from "@/lib/payments/plans";

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

/**
 * Whether a user is on an active paid plan (pro or business). Free users have
 * `plan: "free"` and are never paid regardless of status. Used to gate premium
 * features (e.g. the template marketplace) on both the page and the API route.
 */
export function isPaidUser(
  user: { subscription?: { plan: string; status: string } | null } | null,
): boolean {
  const sub = user?.subscription;
  if (!sub) return false;
  return (
    (PAID_PLANS as readonly string[]).includes(sub.plan) &&
    (sub.status === "active" || sub.status === "trialing")
  );
}
