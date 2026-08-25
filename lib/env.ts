/**
 * Read a required environment variable, allowing a `devDefault` fallback
 * outside production. In production a missing/empty value throws instead of
 * silently falling back — so a deploy that forgot to set, say, APP_URL or
 * RESEND_FROM fails loudly the first time the feature is used, rather than
 * quietly sending emails with a `http://localhost:3000` link or a generic
 * from address.
 *
 * Reads `process.env.NODE_ENV` (set by Next.js to "production" in built apps,
 * "development" locally) as the dev/prod signal, matching the rest of the
 * codebase.
 */
export function requireEnv(name: string, devDefault: string): string {
  const v = process.env[name];
  if (v && v.trim()) return v.trim();
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      `Missing required env var ${name}. Set it before deploying to production.`,
    );
  }
  return devDefault;
}