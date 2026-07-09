import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Prisma + bcryptjs are server-only and need to be externalized by Turbopack.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
