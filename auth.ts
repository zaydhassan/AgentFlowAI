// Full Auth.js v5 init. Server-only. Wires the PrismaAdapter to persist
// users/accounts/sessions, and augments the JWT with the AgentFlow-specific
// session shape (role, orgId, stripeCustomerId).

import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/db";
import { authConfig } from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: PrismaAdapter(prisma),
  callbacks: {
    ...authConfig.callbacks,
    // Persist custom fields onto the JWT.
    async jwt({ token, user, trigger, session }) {
      // First call: user was just created/fetched by authorize() or OAuth.
      if (user) {
        token.sub = user.id;
      }

      // Hydrate from DB on first JWT or on session update.
      if (token.sub && (!token.role || trigger === "update")) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            role: true,
            stripeCustomerId: true,
            memberships: { select: { orgId: true, role: true } },
          },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.stripeCustomerId = dbUser.stripeCustomerId ?? null;
          // First org the user belongs to (typically the one they created).
          const ownerMembership = dbUser.memberships.find((m) => m.role === "owner");
          const anyMembership = ownerMembership ?? dbUser.memberships[0];
          token.orgId = anyMembership?.orgId ?? null;
          // Reflect profile edits (name/photo via /api/user/profile & /api/user/avatar)
          // so useSession() consumers and the JWT stay in sync after an update.
          token.name = dbUser.name;
          token.picture = dbUser.image;
        }
      }

      // Allow client to trigger updates via useSession().update({...}).
      if (trigger === "update" && session) {
        if (typeof session.role === "string") token.role = session.role;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.sub) session.user.id = token.sub;
      session.user.role = (token.role as string) ?? "user";
      session.user.stripeCustomerId = (token.stripeCustomerId as string) ?? null;
      session.user.orgId = (token.orgId as string) ?? null;
      return session;
    },
  },
  events: {
    async signIn({ user, isNewUser, account }) {
      // Best-effort audit log. Never blocks the sign-in.
      if (user?.id) {
        try {
          await prisma.auditLog.create({
            data: {
              userId: user.id,
              action: isNewUser ? "user.signed_up" : "user.signed_in",
              metadata: { provider: account?.provider ?? "credentials" },
            },
          });
        } catch {
          // ignore — auditing is best-effort
        }
      }
    },
  },
});

// Augment the Auth.js types so callers get typed session.user fields.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: string;
      stripeCustomerId: string | null;
      orgId: string | null;
    };
  }
  interface User {
    role?: string;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    sub?: string;
    role?: string;
    stripeCustomerId?: string | null;
    orgId?: string | null;
  }
}
