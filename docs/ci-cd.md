# CI/CD — AgentFlow AI

Two GitHub Actions workflows enforce production-quality standards and publish releases.

| Workflow | File | Trigger | Purpose |
|---|---|---|---|
| **CI** | `.github/workflows/ci.yml` | `pull_request`, `push` to `master`, manual | Validate every change: TypeScript, ESLint, Prisma, build, tests, security, Docker |
| **Release** | `.github/workflows/release.yml` | tag `v*.*.*`, manual | Build & publish Docker images to GHCR + create a GitHub Release |

A **Build Status** badge is rendered at the top of `README.md` (`ci.yml` status). License and TypeScript badges were already present.

## Workflow overview — CI

`ci.yml` runs jobs **in parallel where possible**, with a `concurrency` group that cancels stale runs on the same ref (no duplicate work). Dependency caching is handled by `actions/setup-node@v4` (`cache: npm`).

```
                       ┌─► lint-typecheck  (tsc --noEmit  +  ESLint on changed files)
                       │
  push / PR ───────────┼─► build           (prisma validate → generate → next build → artifacts)
                       │   │
                       │   ├─► docker      (builds Dockerfile + Dockerfile.backend — needs build)
                       │   └─► e2e         (Playwright — only if a config exists)
                       │
                       ├─► test           (npm test --if-present  → no-op until a runner is added)
                       │
                       ├─► security       (npm audit high+, non-blocking  +  dependency summary)
                       └─► dependency-review  (PR only — scans changed package-lock)
```

| Step | Job | Gate? | Notes |
|---|---|---|---|
| Install dependencies (cached) | all | — | `npm ci` from lockfile; npm cache via `setup-node` |
| Cache package manager deps | all | — | `cache: npm` on every `setup-node` |
| TypeScript check (`npx tsc --noEmit`) | lint-typecheck | ✅ fail | Full repo. Requires `prisma generate` first (no postinstall hook). |
| ESLint | lint-typecheck | ✅ fail | **Changed files only** (see note below). |
| Prisma generate | build, test, e2e | — | Generates the client the build needs. |
| Prisma validate | build | ✅ fail | `npx prisma validate`. |
| Next.js production build (`npm run build`) | build | ✅ fail | `output: "standalone"`; logs tee'd to `build.log`. |
| FastAPI tests | — | — | **No FastAPI in this repo** (Next.js monolith) — step intentionally absent. |
| Unit tests | test | optional | `npm test --if-present` (no-op until a `test` script exists). |
| Docker build verification | docker | ✅ fail | Builds both images via Buildx (no push). |
| Playwright | e2e | optional | Runs **only if** `playwright.config.*` exists; otherwise the job is skipped (no fail). |
| `npm audit` | security | ❌ non-blocking | `--audit-level=high`; low/moderate never fail. |
| Dependency summary | security | — | `npm ls --depth=0` → `dependency-summary.md` artifact. |
| Dependency review | dependency-review | ✅ fail (high+) | PR-only; scans changed `package-lock.json` for advisories. |

### Quality gates (fail the pipeline)

The pipeline fails on: **TypeScript errors, ESLint errors on changed files, Prisma validation failure, production build failure, Docker build failure.** Branch protection should require `lint-typecheck`, `build`, and `docker` to pass before merge (configure in *Settings → Branches*).

### Artifacts uploaded

| Artifact | From | Contents |
|---|---|---|
| `build-log` | build | `next build` stdout (`build.log`) — uploaded with `if: always()`. |
| `next-standalone` | build | `.next/standalone`, `.next/static`, `public` (the deployable build). |
| `coverage` | build / test | `coverage/` — only when coverage output exists. |
| `security-audit` | security | `audit.log` + `dependency-summary.md`. |
| `playwright-report` | e2e | Playwright HTML report (when e2e runs). |

### Important: ESLint is enforced on changed files only

The repository has **pre-existing ESLint errors in protected modules** (e.g. `lib/payments/*`, `lib/resend.ts`) that the CI/CD work is **not permitted to modify**. A full-repo `npm run lint` would therefore be permanently red with no way to fix it under the constraints.

CI resolves this with **incremental enforcement**: ESLint runs against the TS/JS files changed in the PR (or the new commit on `master`). New/changed code must be lint-clean; pre-existing debt is cleaned up over time. **TypeScript is enforced on the full repo** (it is currently clean). Run `npm run lint` locally for the complete picture and to find pre-existing findings.

## Workflow overview — Release

`release.yml` triggers on a version tag (`v*.*.*`) or manual dispatch.

1. Matrix builds `Dockerfile` (web) and `Dockerfile.backend` (worker).
2. Logs in to GHCR with the auto-provided `GITHUB_TOKEN` (no extra secret).
3. `docker/metadata-action` derives tags: `:<version>`, `:<major>.<minor>`, `:latest` (tags only), plus the short SHA. Manual runs tag with the input or SHA.
4. Builds & pushes to `ghcr.io/<owner>/agentflow-ai-{web,worker}` with Buildx GHA caching.
5. On a tag, `softprops/action-gh-release` creates a GitHub Release with auto-generated notes (pre-release if the tag contains a dash, e.g. `v1.0.0-rc1`).

## Secrets required

| Secret / var | Where | Required | Purpose |
|---|---|---|---|
| `GITHUB_TOKEN` | auto-provided | always | GHCR push + Release creation. Workflow sets the needed `permissions:` (`packages: write`, `contents: write`). |
| `NEXT_PUBLIC_APP_URL` | **Repository variable** (`vars.`) | optional | Public URL baked into the release build. Defaults to `http://localhost:3000`. Set as a *variable*, not a secret (it's public). |

> No additional secrets are required for CI or for pushing images to GHCR. Provider keys (OpenAI, Razorpay, etc.) are **not** needed by CI/CD — they're injected at deploy time (see `docs/docker.md`).

If you later push images to a **private registry** (Docker Hub, ECR), add:
- `DOCKERHUB_USERNAME` + `DOCKERHUB_TOKEN` (Docker Hub), or
- AWS OIDC + `AWS_*` (ECR, keyless via `aws-actions/configure-aws-credentials`).

## How to trigger manually

### CI (re-run validation on any branch)
1. GitHub → **Actions** → **CI** → *Run workflow* → choose the branch → *Run workflow*.
   Or via CLI:
   ```bash
   gh workflow run ci.yml --ref master
   gh run watch
   ```

### Release (publish images without a tag)
1. GitHub → **Actions** → **Release** → *Run workflow* → optionally set an image tag → *Run workflow*.
   ```bash
   gh workflow run release.yml -f tag=0.1.0-dev
   ```

### Release via tag (recommended)
```bash
git tag v0.1.0
git push origin v0.1.0      # triggers release.yml → images + GitHub Release
```

## Local CI parity (run the same checks before pushing)

```bash
npx prisma generate
npx tsc --noEmit
npm run lint
npx prisma validate --schema=prisma/schema.prisma
npm run build
npm audit --audit-level=high
```

## Troubleshooting

**CI fails on `TypeScript check` with `@prisma/client` type errors** — `prisma generate` runs before `tsc` in CI; if you skip it locally you'll see the same errors. Always run `npx prisma generate` after `npm ci` locally.

**CI fails on `Next.js production build`** — the build job sets `DATABASE_URL`/`AUTH_SECRET` to build-only placeholders. If your change introduces build-time code that actually connects to a DB or requires a real secret, gate that code behind a runtime check (it should not run at build time).

**CI fails on `ESLint (changed files)`** — fix the lint errors in the files you changed. This is incremental enforcement: only changed files are checked. Use `npx eslint <your-files>` locally. (Pre-existing errors in untouched protected modules won't block your PR.)

**CI fails on `Docker build`** — the Dockerfile build runs `next build` internally, so a Docker failure often mirrors a `build` job failure; the `docker` job `needs: build`, so check the `build` job first. For a standalone Docker reproduction: `docker build -f <Dockerfile> --target runner .` (Prisma needs debian-slim, not alpine — see `docs/docker.md`).

**`dependency-review` fails on a PR** — a newly added/changed dependency has a **high or critical** advisory. Either bump/replace the dependency or downgrade the gate (`fail-on-severity: moderate`/`low` in `.github/workflows/ci.yml`). Low/moderate never fail.

**`npm audit` reports issues but CI is green** — by design: `--audit-level=high` + `continue-on-error` keeps audit advisory-only. Review the `security-audit` artifact for the full list.

**Playwright job is missing** — the `e2e` job only exists when `playwright.config.*` is present. Add Playwright (`npm i -D @playwright/test && npx playwright init`) and the job appears automatically on the next run.

**No unit tests run** — there's no `test` script in `package.json` today. Add a runner (e.g. `vitest`) and a `"test": "vitest run"` script; the `test` job will pick it up via `npm test --if-present`.

**Build Status badge shows "no status"** — it populates after the first `ci.yml` run on the default branch. If you rename the workflow file, update the badge URL in `README.md`.

**Cancel-in-progress cancels my run** — the `concurrency` group cancels older runs on the same ref when a newer push arrives. To run a specific commit un-cancelled, trigger it manually via *Actions → CI → Run workflow* on a pinned SHA branch.

## File reference

| File | Purpose |
|---|---|
| `.github/workflows/ci.yml` | CI pipeline (lint/typecheck/build/test/security/docker/e2e). |
| `.github/workflows/release.yml` | Release pipeline (GHCR image publish + GitHub Release). |
| `README.md` | Added the CI Build Status badge (License + TypeScript badges already present). |
| `docs/ci-cd.md` | This document. |