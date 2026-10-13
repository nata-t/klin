# Klin App

<!-- klin:if nest-express -->
A full-stack TypeScript monorepo: **NestJS** API (on Express), **React** web
app, **Better Auth**, **Prisma**, and one set of **Zod** schemas shared by both
sides.
<!-- klin:elif nest-fastify -->
A full-stack TypeScript monorepo: **NestJS** API (on Fastify), **React** web
app, **Better Auth**, **Prisma**, and one set of **Zod** schemas shared by both
sides.
<!-- klin:elif express -->
A full-stack TypeScript monorepo: **Express** API, **React** web app, **Better
Auth**, **Prisma**, and one set of **Zod** schemas shared by both sides.
<!-- klin:else -->
A full-stack TypeScript monorepo: **Fastify** API, **React** web app, **Better
Auth**, **Prisma**, and one set of **Zod** schemas shared by both sides.
<!-- klin:endif -->
Scaffolded with [create-klin](https://github.com/klin-dev/klin).

## Quick start

```bash
pnpm install
<!-- klin:if compose -->
pnpm db:up        # local services in Docker
<!-- klin:endif -->
pnpm db:migrate   # create the tables
<!-- klin:if password -->
pnpm db:seed      # demo@example.com / demo-password-123
<!-- klin:endif -->
pnpm dev          # http://localhost:5173 (API on :3000, Prisma Studio on :5555)
```

Run `pnpm klin doctor` if anything misbehaves.

## What's inside

| | |
| --- | --- |
<!-- klin:if nest -->
| **API** — `apps/api` | NestJS 12, Better Auth mounted at `/api/auth`, global auth guard with `@Public()` / `@Roles()` / `@CurrentUser()`, nestjs-zod DTOs from the shared schemas, consistent error envelope, pino logs, `/api/health` |
<!-- klin:elif express -->
| **API** — `apps/api` | Express 5, Better Auth mounted at `/api/auth`, `requireAuth` / `requireRole()` middleware, the shared Zod schemas parsed at the edge, consistent error envelope, pino logs, `/api/health` |
<!-- klin:else -->
| **API** — `apps/api` | Fastify 5, Better Auth mounted at `/api/auth`, `requireAuth` / `requireRole()` hooks, route schemas that are the shared Zod schemas, consistent error envelope, pino logs, `/api/health` |
<!-- klin:endif -->
| **Web** — `apps/web` | Vite + React 19, TanStack Router (file routes, `beforeLoad` guards), TanStack Query (typed client + key conventions), TanStack Form + shadcn/ui, dark mode, error/404/loading states |
<!-- klin:if packages-ui -->
| **Shared** — `packages/*` | `ui` (shadcn/ui components + theme), `validators` (Zod), `db` (Prisma), `auth` (Better Auth config + client), `env` (validated server env), TypeScript & ESLint configs |
<!-- klin:else -->
| **Shared** — `packages/*` | `validators` (Zod), `db` (Prisma), `auth` (Better Auth config + client), `env` (validated server env), TypeScript & ESLint configs |
<!-- klin:endif -->
| **Tooling** | Turborepo, Prettier, ESLint, husky + lint-staged + commitlint, Vitest, Playwright |

**Sign-in:**
<!-- klin:if password -->
email & password (verify, reset);
<!-- klin:endif -->
<!-- klin:if google -->
Google;
<!-- klin:endif -->
<!-- klin:if github -->
GitHub;
<!-- klin:endif -->
<!-- klin:if magic-link -->
magic links;
<!-- klin:endif -->
<!-- klin:if two-factor -->
two-factor (TOTP + backup codes);
<!-- klin:endif -->
<!-- klin:if passkey -->
passkeys;
<!-- klin:endif -->
sessions management.
<!-- klin:if cors || helmet || rate-limit -->

**Security:**
<!-- klin:if cors -->
CORS locked to the web app ·
<!-- klin:endif -->
<!-- klin:if helmet -->
secure headers (helmet) ·
<!-- klin:endif -->
<!-- klin:if rate-limit -->
rate limiting (120 requests/min per IP) ·
<!-- klin:endif -->
consistent error envelopes.
<!-- klin:endif -->
<!-- klin:if organizations || admin || api-keys || email || uploads || queues || i18n -->

**Modules:**
<!-- klin:if organizations -->
organizations & RBAC ·
<!-- klin:endif -->
<!-- klin:if admin -->
admin dashboard ·
<!-- klin:endif -->
<!-- klin:if api-keys -->
API keys ·
<!-- klin:endif -->
<!-- klin:if email -->
transactional email (Resend + React Email) ·
<!-- klin:endif -->
<!-- klin:if uploads -->
file uploads (S3/R2 presigned URLs) ·
<!-- klin:endif -->
<!-- klin:if queues -->
background jobs (BullMQ) ·
<!-- klin:endif -->
<!-- klin:if i18n -->
i18n (i18next) ·
<!-- klin:endif -->
`pnpm klin list` shows everything you can add.
<!-- klin:endif -->

## Build a feature

```bash
pnpm klin generate resource project name:string budget:int? due:date?
pnpm db:migrate --name add-projects
```

<!-- klin:if nest -->
That writes the Zod schemas, Prisma model, Nest module (with nestjs-zod DTOs),
TanStack Query hooks, form and page, and wires them together.
<!-- klin:else -->
That writes the Zod schemas, Prisma model, API routes and service, TanStack
Query hooks, form and page, and wires them together.
<!-- klin:endif -->

Need another UI component? `pnpm ui:add dialog` — see
[UI & theming](packages/docs/ui.md). Read
[Add a feature](packages/docs/add-a-feature.md) for the walkthrough.

## Docs

[`packages/docs`](packages/docs/README.md) covers getting started,
architecture, how the shared validators flow, adding features, testing,
deployment and upgrading.

## Scripts

| | |
| --- | --- |
| `pnpm dev` / `build` / `start` | Develop, build, run production builds |
| `pnpm lint` / `typecheck` / `test` / `test:e2e` | Checks |
| `pnpm db:migrate` / `db:studio` / `db:seed` / `db:reset` | Database |
| `pnpm klin add` / `remove` / `generate` / `doctor` | The klin CLI |
