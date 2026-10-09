# Getting started

## Run it

```bash
pnpm install          # if create-klin didn't already
<!-- klin:if compose -->
pnpm db:up            # start local services in Docker
<!-- klin:endif -->
pnpm db:migrate       # create the database tables
<!-- klin:if password -->
pnpm db:seed          # optional: demo admin + sample notes
<!-- klin:endif -->
pnpm dev              # web on :5173, API on :3000
```

Open <http://localhost:5173>.
<!-- klin:if password -->
Sign up, or use the seeded account `demo@example.com` / `demo-password-123`.
<!-- klin:endif -->

> Something off? `pnpm klin doctor` checks your Node version, `.env`, database
> connection, generated code and dependency versions, and tells you how to fix
> what it finds.

## What's where

```
apps/
  api/            NestJS API — modules, guards, the Better Auth mount
  web/            Vite + React — TanStack Router/Query/Form, shadcn/ui
packages/
  validators/     Zod schemas shared by the API and the web app
  db/             Prisma schema (prisma/models/*.prisma) and client
  auth/           Better Auth server config + typed client
  env/            Validated server environment (fails fast on boot)
<!-- klin:if email -->
  email/          React Email templates + Resend
<!-- klin:endif -->
  typescript-config/, eslint-config/   shared tooling
  docs/           you are here
```

## Everyday scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Runs everything in watch mode |
| `pnpm build` | Production builds (cached by Turborepo) |
| `pnpm lint` · `pnpm typecheck` · `pnpm test` | Quality checks |
| `pnpm test:e2e` | Playwright against production builds (`pnpm build` first) |
| `pnpm db:migrate` | Create + apply a migration after editing `prisma/models` |
| `pnpm db:studio` | Browse the database |
| `pnpm db:seed` | Load demo data |
<!-- klin:if compose -->
| `pnpm db:up` · `pnpm db:down` | Start / stop local Docker services |
<!-- klin:endif -->
<!-- klin:if email -->
| `pnpm email:dev` | Preview email templates at <http://localhost:3030> |
<!-- klin:endif -->
| `pnpm klin generate resource …` | Scaffold a feature end to end |
| `pnpm klin add …` · `pnpm klin remove …` | Switch modules on or off |
| `pnpm klin doctor` | Health check |

## Environment

There's one `.env` at the repo root, shared by every app. `create-klin` made it
for you with fresh secrets. `.env.example` documents every variable; the API
validates them on boot (`packages/env`) and refuses to start with a clear
message if something is missing.

Only `VITE_*` variables reach the browser. Never put secrets in them.

## Commits

Commits follow [Conventional Commits](https://www.conventionalcommits.org)
(`feat: …`, `fix(api): …`), enforced by commitlint. Staged files are formatted
with Prettier on commit (husky + lint-staged).
