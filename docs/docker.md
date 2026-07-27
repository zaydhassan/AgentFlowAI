# Docker — AgentFlow AI

Containerize the entire stack with one command.

> **About the service list.** The brief asked for Docker support for *Next.js, FastAPI, PostgreSQL, Redis, BullMQ Worker*. AgentFlow AI is a **Next.js monolith** — there is **no FastAPI/Python service** in this repository. Next.js serves both the React UI and the API (`app/api/**`). The "backend" Dockerfile (`Dockerfile.backend`) therefore containerizes the **BullMQ background worker** (the real background-processing service), not a Python backend. If a FastAPI service is added later, add a `Dockerfile.api` and a new compose service — the architecture below accommodates it without changes to the existing services.

## Services

| Service   | Image / Dockerfile        | Role                                              | Port        |
|-----------|--------------------------|---------------------------------------------------|-------------|
| `db`      | `postgres:16-alpine`     | PostgreSQL database (named volume `pgdata`)       | — (internal)|
| `redis`   | `redis:7-alpine`         | Cache + BullMQ broker (named volume `redisdata`)  | — (internal)|
| `migrate` | `Dockerfile` (deps stage)| One-shot `prisma migrate deploy`, then exits       | —           |
| `web`     | `Dockerfile` (runner)     | Next.js — UI + API (standalone `node server.js`)  | 3000        |
| `worker`  | `Dockerfile.backend`     | BullMQ worker (same standalone server, autostart)  | — (internal)|

**Why does the worker run the Next.js server?** The worker handler (`lib/queue/workers/memory-embedding`) is imported by `instrumentation.ts` during Next's server boot, so the worker code only exists inside Next's standalone server bundle. The dedicated worker container therefore runs the same standalone server with `QUEUE_WORKER_AUTOSTART=true`; its HTTP port is **not published** — it exists only to host the worker and answer the liveness healthcheck. In dev the worker instead runs **in-process** inside the `web` container (`QUEUE_WORKER_AUTOSTART=true`), mirroring local `npm run dev`.

## Architecture

```
                ┌─────────────────── agentflow-net (bridge) ───────────────────┐
   host:3000 ──►│  web (Next.js)  ──┐                              ┌─► db (postgres)  │
                │  runner: nodejs   │  depends_on (healthy)        │   volume: pgdata  │
                │  non-root: 1001   │  web  → db, redis, migrate    │                   │
                │                   │  worker → db, redis, migrate  ├─► redis           │
                │  worker (prod)    │  migrate → db                 │   volume: redisdata│
                │  autostart=true    │                               │                   │
                │  no published port│                               │                   │
                └───────────────────┘                               └───────────────────┘
                          │
                          ▼
                   migrate (one-shot: prisma migrate deploy)
```

- **Internal networking:** all services share `agentflow-net`; the web/worker connect to `db` and `redis` by service name (`postgresql://agentflow:agentflow@db:5432/agentflow`, `redis://redis:6379`).
- **Dependency ordering** is enforced with `depends_on` health conditions:
  - PostgreSQL starts before the backend → `migrate` and `web` depend on `db` (service_healthy).
  - Redis starts before workers → `worker` depends on `redis` (service_healthy).
  - Workers wait for Redis → `worker` depends on `redis` (service_healthy).
  - Frontend waits for backend → `web` depends on `db`, `redis`, and `migrate` (service_completed_successfully). (In this monolith the web service *is* the backend; it waits for the backing services + migrations.)
- **Named volumes:** `pgdata`, `redisdata` (survive `docker compose down`, removed by `down -v`).
- **Restart policies:** `unless-stopped` (dev), `always` (prod).
- **Health checks:** every long-lived service has one (`/api/health/live` for web/worker, `pg_isready` for db, `redis-cli ping` for redis).
- **Non-root:** web and worker run as `nextjs` (uid 1001).
- **Multi-stage + minimized image:** `deps → builder → runner`; the runner copies only Next's standalone output (a pruned `node_modules` traced by Next) + static assets + the Prisma engine.

## Prerequisites

- Docker Engine 24+ with the Compose v2 plugin (`docker compose …`)
- ~3 GB free RAM (db 1G, redis 512M, web 1G, worker 768M in prod)
- A `.env` file (see Installation)

## Installation

```bash
git clone <repo-url> agentflow-ai && cd agentflow-ai

# 1. Create .env from the template and fill in secrets.
cp .env.example .env
#   Required for production:
#     AUTH_SECRET            — generate: openssl rand -base64 32
#     POSTGRES_PASSWORD       — a strong db password (prod only)
#     NEXT_PUBLIC_APP_URL     — your public URL, e.g. https://app.example.com
#   Optional (the app degrades gracefully if unset):
#     OPENAI_API_KEY / ANTHROPIC_API_KEY, RAZORPAY_*, INTEGRATIONS_ENCRYPTION_KEY, …
#   Infrastructure vars (DATABASE_URL, REDIS_URL, QUEUE_*) are set by compose
#   and OVERRIDE .env so the services use the internal Docker hostnames.
```

## Development

Hot-reload dev stack (bind-mounts your source, runs `next dev`):

```bash
docker compose up                 # web + db + redis + migrate (worker runs in-process)
# Open http://localhost:3000

# Want a dedicated worker container in dev instead of in-process?
docker compose --profile worker up
```

- The `web` container runs `next dev` with file polling (`WATCHPACK_POLLING=true` / `CHOKIDAR_USEPOLLING=true`) for reliable HMR on Windows/macOS.
- `node_modules` and `.next` are anonymous volumes so the image-installed deps/build cache aren't shadowed by the host.
- Migrations run automatically once via the `migrate` one-shot before `web` starts. For schema changes, edit `prisma/schema.prisma` locally and run `npx prisma migrate dev --name <change>` on the host (needs Node), then restart.

## Production

```bash
# .env MUST contain: POSTGRES_PASSWORD, AUTH_SECRET, NEXT_PUBLIC_APP_URL (+ provider keys)
docker compose -f docker-compose.prod.yml up -d --build
```

- Builds the standalone `runner` images (web + dedicated worker), restart: always, resource limits per service.
- `web` runs `QUEUE_WORKER_AUTOSTART=false` (web-only); `worker` runs `QUEUE_WORKER_AUTOSTART=true`.
- Only `web` publishes a port (`${WEB_PORT:-3000}:3000`). Put a reverse proxy (TLS) in front.

To run prod layered on top of dev (override semantics):

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

## Common commands

```bash
# Build images without starting
docker compose build
docker compose -f docker-compose.prod.yml build

# Start in background
docker compose up -d

# Tail logs (all / one service)
docker compose logs -f
docker compose logs -f web

# Recreate a single service after a code/config change (dev reuses the bind mount)
docker compose up -d --build web

# Run a one-off command in the running web container
docker compose exec web sh

# Run Prisma Studio against the dev db
docker compose exec web ./node_modules/.bin/prisma studio

# Status + health
docker compose ps

# Stop (keeps volumes)
docker compose down

# Stop AND delete data (fresh database)
docker compose down -v

# Re-run migrations manually
docker compose run --rm migrate ./node_modules/.bin/prisma migrate deploy

# Reset the DB entirely (dev)
docker compose down -v && docker compose up
```

## Troubleshooting

**`web`/`worker` never become healthy** — check `docker compose logs web`. The healthcheck hits `/api/health/live`; if it 502s, the app booted but a dependency is failing. `docker compose logs db redis` first. If migrations failed, `docker compose logs migrate`.

**`migrate` fails / `P1003: Database does not look like a known database`** — the `migrate` service depends on `db` being healthy; if it ran too early, `docker compose up -d --force-recreate migrate` then `docker compose up -d web worker`.

**Prisma error `PrismaClientInitializationError` / missing engine in prod** — the runner copies `node_modules/.prisma` (the native engine). If you change `binaryTargets` in `prisma/schema.prisma`, rebuild: `docker compose -f docker-compose.prod.yml build --no-cache web worker`. Alpine hosts require `binaryTargets = ["native", "linux-alpine"]`; this setup uses debian-slim so the default engine works.

**HMR not updating (dev)** — ensure Docker Desktop has your project folder shared; file polling is enabled by default. On WSL2/native Linux you can drop `WATCHPACK_POLLING=true` for native events.

**`getaddrinfo ENOTFOUND db` / `redis`** — you're running a service outside the `agentflow-net` network, or overriding `DATABASE_URL`/`REDIS_URL` in `.env` to a value that wins over compose. Keep those vars out of `.env` (compose sets them) or set them to the internal hostnames (`db`/`redis`).

**Port 3000 already in use** — set `WEB_PORT=3100` (prod) in `.env` and `docker compose up -d`.

**Out of memory** — lower the `deploy.resources.limits` in `docker-compose.prod.yml`, or scale horizontally with `docker compose up -d --scale web=2 --scale worker=2`.

**`POSTGRES_PASSWORD is required` / `NEXT_PUBLIC_APP_URL is required`** — prod compose uses `${VAR:?…}` to fail fast; set them in `.env`.

**Rebuild is slow** — `deps` (`npm ci`) is the cost; it's cached by BuildKit. Touching `package.json`/`package-lock.json` invalidates it. Use `docker compose build web` (not `--no-cache`) for incremental builds.

## File reference

| File                  | Purpose                                                       |
|-----------------------|--------------------------------------------------------------|
| `Dockerfile`          | Web image (Next.js standalone). Stages: base/deps/builder/dev/runner. |
| `Dockerfile.backend`  | Worker image (same standalone server, autostart, no port).    |
| `docker-compose.yml`  | Dev stack (HMR, in-process worker, restart: unless-stopped).  |
| `docker-compose.prod.yml` | Prod stack (standalone, dedicated worker, restart: always, resource limits). |
| `.dockerignore`       | Keeps secrets + node_modules/.next out of the build context.  |
| `next.config.ts`      | Added `output: "standalone"` (build-output flag for Docker).  |