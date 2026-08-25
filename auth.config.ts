import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import { LoginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { prisma } from "@/lib/db";

const PUBLIC_ROUTES = new Set<string>([
  "/",
  "/pricing",
  "/about",
  "/contact",
  "/privacy",
  "/terms",
  "/security",
  "/docs",
  "/changelog",
  "/login",
  "/signup",
  "/forgot-password",
  "/reset-password",
  "/verify-email",
  "/login/error",
  "/signup/error",
]);

function isPublic(pathname: string): boolean {
  if (pathname.startsWith("/api/auth")) return true;
  if (pathname.startsWith("/api/payments/webhook")) return true;
  if (pathname === "/login/error" || pathname === "/signup/error") return true;
  if (pathname === "/docs" || pathname.startsWith("/docs/")) return true;
  return PUBLIC_ROUTES.has(pathname);
}

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
    error: "/login/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days
    updateAge: 24 * 60 * 60,  // refresh once a day
  },
  providers: [
    // OAuth providers only register their metadata here; the actual flow runs
    // through the Auth.js route handler. We only instantiate a provider if
    // its env vars are present, so missing OAuth doesn't crash boot.
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    ...(process.env.AUTH_GITHUB_ID && process.env.AUTH_GITHUB_SECRET
      ? [
          GitHub({
            clientId: process.env.AUTH_GITHUB_ID,
            clientSecret: process.env.AUTH_GITHUB_SECRET,
            allowDangerousEmailAccountLinking: true,
          }),
        ]
      : []),
    Credentials({
      // We re-validate with the zod schema before doing anything else.
      authorize: async (raw) => {
        const parsed = LoginSchema.safeParse(raw);
        if (!parsed.success) return null;
        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
            emailVerified: true,
            passwordHash: true,
            role: true,
          },
        });
        if (!user || !user.passwordHash) return null;

        const ok = await verifyPassword(password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          // Surface emailVerified so the session callback can require it.
          emailVerified: user.emailVerified,
        };
      },
    }),
  ],
  callbacks: {
    // Proxy / route handler gate. Returning false triggers a redirect to
    // pages.signIn. Returning true lets the request through.
    authorized: ({ auth, request }) => {
      const { pathname } = request.nextUrl;
      if (pathname.startsWith("/api/auth")) return true;
      if (pathname.startsWith("/api/payments/webhook")) return true;
      // Always allow Next internals and static files (the matcher handles most).
      if (pathname.startsWith("/_next")) return true;
      if (pathname.startsWith("/favicon")) return true;

      if (isPublic(pathname)) {
        if (
          auth?.user &&
          (pathname === "/login" || pathname === "/signup" || pathname === "/")
        ) {
          if (pathname === "/") return true; // landing is fine for everyone
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }
      return Boolean(auth?.user);
    },
  },
} satisfies NextAuthConfig;
