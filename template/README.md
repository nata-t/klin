# Klin App

A full-stack TypeScript monorepo: **NestJS** API, **React** web app, **Better
Auth**, **Prisma**, and one set of **Zod** schemas shared by both sides.
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
pnpm dev          # http://localhost:5173 (API on :3000)
```

Run `pnpm klin doctor` if anything misbehaves.

## What's inside

| | |
| --- | --- |
| **API** — `apps/api` | NestJS 12, Better Auth mounted at `/api/auth`, global auth guard with `@Public()` / `@Roles()` / `@CurrentUser()`, Zod validation via Standard Schema, consistent error envelope, pino logs, rate limiting, helmet, `/api/health` |
| **Web** — `apps/web` | Vite + React 19, TanStack Router (file routes, `beforeLoad` guards), TanStack Query (typed client + key conventions), TanStack Form + shadcn/ui, dark mode, error/404/loading states |
| **Shared** — `packages/*` | `validators` (Zod), `db` (Prisma), `auth` (Better Auth config + client), `env` (validated server env), TypeScript & ESLint configs |
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

That writes the Zod schemas, Prisma model, Nest module, TanStack Query hooks,
form and page, and wires them together. Read
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
