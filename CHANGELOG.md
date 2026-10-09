# Changelog

All notable changes to `create-klin` and its template. This file is maintained
by [Changesets](https://github.com/changesets/changesets).

## 0.1.0

First release.

### CLI

- `create-klin`: interactive or flag-driven setup with presets (`recommended`,
  `saas`, `minimal`, `everything`), pnpm/bun/npm, Postgres/MySQL/SQLite and an
  accent color; strips unused modules, writes `.env` with generated secrets,
  runs git init, install and `prisma generate`, and commits.
- `klin generate resource`: Zod schemas, Prisma model, Nest module, TanStack
  Query hooks, form, list page, route and nav entry in one command; field types
  `string text int float boolean date datetime enum`, optional fields, and
  user/organization/global ownership.
- `klin add` / `klin remove`: switch modules on or off later with 3-way
  merges; insertions next to anchors merge automatically.
- `klin doctor`: toolchain, `.env`, database/Redis/storage reachability, ports,
  generated code, migrations, dependency version drift.
- `klin list`, `klin upgrade` (experimental), `--template` for custom
  templates (local folder or GitHub).

### Template

- NestJS 12 API with Better Auth, Standard Schema validation, response schemas,
  a consistent error envelope, pino, throttling, helmet and health checks.
- Vite + React 19 web app with TanStack Router/Query/Form, shadcn/ui (Base UI),
  layouts, dark mode, a form kit, and auth flows for every provider.
- Optional organizations & RBAC, admin, API keys, email, uploads, queues, i18n,
  Docker and CI modules, plus a docs package.
