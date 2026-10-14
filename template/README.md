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
Scaffolded with [create-klin](https://github.com/nata-t/klin).

## Requirements

<!-- klin:if bun -->
- Node.js 22.12 or newer, and bun
<!-- klin:elif npm -->
- Node.js 22.12 or newer (npm comes with it)
<!-- klin:else -->
- Node.js 22.12 or newer, and pnpm
<!-- klin:endif -->
<!-- klin:if compose -->
- Docker, for the local services in `docker-compose.yml`
<!-- klin:endif -->

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

Then open http://localhost:5173. Run `pnpm klin doctor` if anything
misbehaves: it checks your toolchain, `.env`, database and services, ports and
dependency versions, and says how to fix what it finds.

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
<!-- klin:if next -->
| **Web** — `apps/web` | Next.js 16 (App Router) + React 19, signed-in pages checked on the server (`proxy.ts` + layouts), `/api` rewritten to the API, TanStack Query (typed client + key conventions), TanStack Form + shadcn/ui, dark mode, error/404/loading states |
<!-- klin:else -->
| **Web** — `apps/web` | Vite + React 19, TanStack Router (file routes, `beforeLoad` guards), TanStack Query (typed client + key conventions), TanStack Form + shadcn/ui, dark mode, error/404/loading states |
<!-- klin:endif -->
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

## Layout

```
apps/
  api/                  the API (:3000)
  web/                  the web app (:5173)
packages/
  validators/           Zod schemas shared by both apps — data shapes start here
  db/                   Prisma schema (prisma/models/*.prisma), client, migrations
  auth/                 Better Auth server config and typed client
  env/                  the server environment, validated on boot
<!-- klin:if packages-ui -->
  ui/                   shadcn/ui components and theme (@repo/ui)
<!-- klin:endif -->
<!-- klin:if email -->
  email/                React Email templates
<!-- klin:endif -->
  docs/                 guides for this codebase
klin.json               what create-klin generated (used by pnpm klin add/remove/upgrade)
AGENTS.md               conventions for AI coding assistants
```

## Environment

`.env` was created with fresh secrets; `.env.example` documents every
variable. `packages/env` validates them on boot, and a missing or malformed
value stops the app with a message naming it.
<!-- klin:if oauth -->

OAuth sign-in stays off until you add its keys to `.env`:

<!-- klin:endif -->
<!-- klin:if google -->
- **Google:** create OAuth credentials at https://console.cloud.google.com/apis/credentials with the redirect URI `http://localhost:5173/api/auth/callback/google`, then set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.
<!-- klin:endif -->
<!-- klin:if github -->
- **GitHub:** create an OAuth app at https://github.com/settings/developers with the callback URL `http://localhost:5173/api/auth/callback/github`, then set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET`.
<!-- klin:endif -->
<!-- klin:if email -->

Leave `RESEND_API_KEY` empty in development: emails are printed to the API
console instead.
<!-- klin:endif -->

## Build a feature

```bash
pnpm klin generate resource billing/invoice
pnpm db:migrate --name add-invoice
```

<!-- klin:if nest -->
That writes the Zod schemas, a Prisma model, a Nest module (controller with the
five REST endpoints, service, nestjs-zod DTOs), TanStack Query hooks, a form and
a page, and wires them together — you add the fields. `pnpm klin generate`
alone asks what to make; `backend` and `frontend` make just one side.
<!-- klin:else -->
That writes the Zod schemas, a Prisma model, API routes and a service,
TanStack Query hooks, a form and a page, and wires them together — you add the
fields. `pnpm klin generate` alone asks what to make; `backend` and `frontend`
make just one side.
<!-- klin:endif -->

Need another UI component? `pnpm ui:add dialog` — see
[UI & theming](packages/docs/ui.md). Read
[Add a feature](packages/docs/add-a-feature.md) for the walkthrough.

## Deploy

<!-- klin:if docker -->
`docker-compose.prod.yml` runs the whole stack from the production images on
one machine. [Deployment](packages/docs/deployment.md) covers that, building
the images to run anywhere, platform builds without Docker, and the
environment checklist.
<!-- klin:else -->
[Deployment](packages/docs/deployment.md) covers platform builds, running the
apps on a server, and the environment checklist.
<!-- klin:endif -->

## Troubleshooting

<!-- klin:if compose -->
- **Docker says "permission denied" (Linux):** add your user to the `docker`
  group once (`sudo usermod -aG docker $USER`, then `newgrp docker` or log in
  again). On macOS and Windows, quit and reopen Docker Desktop.
<!-- klin:endif -->
- **A port is taken:** the API's port is `API_PORT` in `.env`; the web app's
  is in `apps/web/package.json`.
- **Conflict markers after `pnpm klin add` / `remove`:** you and the template
  changed the same lines. Resolve them like a git merge conflict, then run
  `pnpm typecheck`.
- **Anything else:** `pnpm klin doctor`.

## Docs

[`packages/docs`](packages/docs/README.md) covers getting started,
architecture, how the shared validators flow, adding features, testing,
deployment and upgrading.

## Scripts

| | |
| --- | --- |
| `pnpm dev` | Web, API and Prisma Studio side by side in Turborepo's TUI |
| `pnpm build` / `start` | Production builds, and running them |
| `pnpm lint` / `typecheck` / `test` / `test:e2e` | ESLint, TypeScript, Vitest, Playwright |
| `pnpm format` / `format:check` | Prettier |
<!-- klin:if compose -->
| `pnpm db:up` / `db:down` | Start / stop the local services in Docker |
<!-- klin:endif -->
| `pnpm db:migrate` / `db:deploy` / `db:push` / `db:reset` | Database schema |
| `pnpm db:seed` / `db:studio` | Demo data · Prisma Studio |
| `pnpm ui:add <component>` | Add a shadcn/ui component |
<!-- klin:if email -->
| `pnpm email:dev` | Preview the email templates |
<!-- klin:endif -->
| `pnpm klin add` / `remove` / `generate` / `doctor` / `list` | The klin CLI |
