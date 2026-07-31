import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Server-only packages that import Node builtins (crypto, net, stream, …)
  // and must be externalized so Turbopack/webpack don't try to bundle them.
  // Missing entries here surface as "Module not found: Can't resolve 'crypto'"
  // (webpack) or a misleading "MODULE_UNPARSABLE / file not found" on the
  // instrumentation hook (Turbopack). bullmq + ioredis are pulled in via
  // lib/queue -> instrumentation.ts.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "bullmq", "ioredis"],
  // Remote avatar hosts. OAuth providers store profile image URLs on the
  // user record; these allow `next/image` to optimize them. The top-nav
  // avatar currently uses a plain <img> (so it isn't gated by this list),
  // but any future next/image usage of these URLs needs these entries.
  images: {
    remotePatterns: [
      // Google OAuth profile photos.
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "**.googleusercontent.com" },
      // GitHub OAuth profile photos.
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      // Gravatar (used by some providers / email-based avatars).
      { protocol: "https", hostname: "secure.gravatar.com" },
      { protocol: "https", hostname: "**.gravatar.com" },
    ],
  },
  // Produce a self-contained server build (`.next/standalone`) for Docker /
  // containerized deployments. Next traces the import graph and emits a
  // minimal `server.js` + a pruned `node_modules`, so the runtime image stays
  // small. `next dev` and `next start` are unaffected. See Dockerfile.
  output: "standalone",
};

export default nextConfig;
