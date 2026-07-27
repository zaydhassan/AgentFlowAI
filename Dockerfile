# syntax=docker/dockerfile:1.7
# =============================================================================
# AgentFlow AI — web image (Next.js, standalone).
# AgentFlow AI is a Next.js monolith: this image serves BOTH the React UI and
# the API routes (app/api/**). There is no separate FastAPI service in this
# repository. The "backend" Dockerfile (Dockerfile.backend) containerizes the
# BullMQ background worker instead.
#
# Multi-stage: base → deps → builder → (dev | runner).
#   • `dev`    — full deps + source, runs `next dev` with HMR (compose: target dev)
#   • `runner` — pruned standalone build, non-root, runs `node server.js` (prod)
# Build with: docker build --target runner -t agentflow-ai-web .
# =============================================================================

ARG NODE_VERSION=20-bookworm-slim

# ---------- base — shared foundation (openssl for the Prisma engine) ----------
FROM node:${NODE_VERSION} AS base
WORKDIR /app
# node:slim lacks the OpenSSL userspace Prisma's query/migration engines need.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
ENV NEXT_TELEMETRY_DISABLED=1

# ---------- deps — install all (incl dev) deps + generate Prisma client --------
FROM base AS deps
COPY package.json package-lock.json* ./
COPY prisma ./prisma
# `npm ci` from the lockfile (deterministic). Generate the Prisma client so the
# build (and the migrate one-shot) have the generated client + query engine.
RUN npm ci \
  && npx prisma generate \
  && npm cache clean --force

# ---------- builder — compile the production standalone build ------------------
FROM deps AS builder
COPY . .
# NEXT_PUBLIC_* vars are inlined at BUILD time. Pass the public app URL in for
# prod builds; dev/unset falls back to localhost.
ARG NEXT_PUBLIC_APP_URL=http://localhost:3000
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
RUN npm run build

# ---------- dev — live-reload dev server (HMR) --------------------------------
# Used by docker-compose.yml (dev). Source + node_modules are bind-mounted in
# compose, so changes hot-reload without rebuilding the image.
FROM deps AS dev
COPY . .
ENV NODE_ENV=development \
    WATCHPACK_POLLING=true \
    CHOKIDAR_USEPOLLING=true
EXPOSE 3000
# Regenerate the Prisma client (schema may have changed in the bind mount) then
# start the dev server.
CMD ["sh", "-c", "npx prisma generate && npm run dev"]

# ---------- runner — minimal production image (non-root) ---------------------
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0
# Non-root user (uid/gid 1001).
RUN groupadd --system --gid 1001 nodejs \
  && useradd --system --uid 1001 --gid nodejs --home-dir /app nextjs

WORKDIR /app
# Standalone server (server.js + a pruned node_modules subset traced by Next).
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
# Static assets + public are NOT part of standalone — copy them separately.
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
# Prisma: schema + migrations (for the migrate one-shot), the generated client,
# its native query engine, and @prisma/client (externalized by Next).
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

USER nextjs
EXPOSE 3000
# Liveness probe: the app exposes GET /api/health/live → {"status":"ok"} (lib/health).
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health/live').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]