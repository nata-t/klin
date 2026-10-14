---
"create-klin": major
---

First stable release. `npm create klin@latest` scaffolds a full-stack TypeScript monorepo (an API, a web app and one set of Zod schemas shared by both), and the `klin` CLI keeps working inside it.

**Create**

- A six-step, full-screen, keyboard-driven wizard, or flags plus `--yes` for scripts and CI.
- API: NestJS 12 (on Express or Fastify, with nestjs-zod DTOs) or plain Express 5 / Fastify 5 with the same schemas. CORS, Helmet and rate limiting are on by default, with an amber warning if you switch one off.
- Web app: Vite + TanStack Router, or Next.js 16 (App Router). The choice is made once, at create.
- Database: Postgres, MySQL or SQLite through Prisma.
- Sign-in with Better Auth: email and password, Google, GitHub, magic links, two-factor (TOTP), passkeys. Plugins: organizations & RBAC, admin, API keys.
- Extras: transactional email (Resend + React Email), S3/R2 uploads, BullMQ background jobs, i18n, Docker, GitHub Actions CI.
- shadcn/ui in `apps/web` or a shared `packages/ui`, in any of shadcn's 18 theme colors.
- Presets: `recommended`, `saas`, `minimal` (plain Fastify on SQLite, no Docker) and `everything`. Package managers: bun (the default), pnpm or npm.
- Unused code is stripped, `.env` gets fresh secrets, then dependencies are installed, the Prisma client is generated and the first commit is made. The closing next steps, and `klin doctor`, explain how to fix Docker access on your OS when it's missing.

**Grow**

- `klin generate resource | backend | frontend <name>` writes skeletons: Zod schemas, a Prisma model, a Nest module or plain routes with the five REST endpoints, TanStack Query hooks, a form, a page, its route and a sidebar entry. Slashes in the name make folders (`billing/invoice`). Use `--url`, `--plural`, `--no-model`, `--no-validation`, `--no-route` and `--no-nav` to shape the output, and `--backend-dir`, `--frontend-dir`, `--validation-dir` and `--model-dir` (or `klin generate paths` for project defaults) to choose where files go.
- `klin add` / `klin remove` switch modules on and off after create with 3-way merges, so your edits are kept.
- `klin doctor` checks your toolchain, `.env`, database and services, ports, generated code, migrations and dependency drift. `klin list` shows the available modules and which are switched on.
- `klin upgrade` merges template improvements into an existing project (experimental).
- `--template ./folder` or `--template github:you/your-template` renders your own fork of the template.
