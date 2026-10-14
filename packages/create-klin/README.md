# create-klin

Scaffold a spotless full-stack TypeScript monorepo: a **NestJS 12** or plain
**Express / Fastify** API, a **Vite + TanStack Router** or **Next.js 16** web
app, **Better Auth**, **Prisma**, **TanStack Query/Form** and **shadcn/ui**,
with one set of Zod schemas shared by the API and the web app. Then keep using
the `klin` CLI inside the project to generate features and switch modules on
and off.

```bash
npm create klin@latest
pnpm create klin
bun create klin
```

![The create-klin wizard: name the kit, pick a preset, choose NestJS and Next.js, review, build, then the next steps](https://raw.githubusercontent.com/nata-t/klin/master/demo/demo.gif)

## Quick start

```bash
bun create klin my-app
cd my-app
bun run db:up        # Postgres (and Redis/storage, if picked) in Docker
bun run db:migrate   # create the tables
bun run db:seed      # demo@example.com / demo-password-123
bun run dev          # web :5173 · API :3000 · Prisma Studio :5555
```

**Requirements:** Node.js 22.12+, and bun, pnpm or npm. Docker for local
Postgres/MySQL, Redis (background jobs) and S3-compatible storage (uploads);
the `minimal` preset (SQLite) needs no Docker. git is optional.

## What you pick

A six-step, full-screen, keyboard-driven wizard (or flags plus `--yes`):

- **API:** NestJS (with nestjs-zod DTOs) or plain, on Express or Fastify. CORS, Helmet and rate limiting are on by default.
- **Web app:** Vite + TanStack Router, or Next.js (App Router, signed-in pages checked on the server).
- **Database:** Postgres, MySQL or SQLite, through Prisma.
- **Sign-in:** email & password, Google, GitHub, magic links, two-factor (TOTP), passkeys. Power-ups: organizations & RBAC, admin dashboard, API keys.
- **Extras:** transactional email (Resend + React Email), S3/R2 uploads, BullMQ background jobs, i18n, Docker, GitHub Actions + Renovate.
- **Looks:** shadcn/ui in `apps/web` or a shared `packages/ui`, in any of shadcn's 18 theme colors.

Unused code is stripped, `.env` gets fresh secrets, dependencies are
installed, the Prisma client is generated and the first commit is made.

**Presets:** `recommended` (the default: NestJS, Postgres, Docker, CI) ·
`saas` (OAuth, 2FA, organizations, admin, email, uploads, jobs) · `minimal`
(plain Fastify on SQLite, no Docker) · `everything` (every module on).

## Flags

```bash
npm create klin@latest [name] [options]
```

| Flag | Values |
| --- | --- |
| `--preset <id>` | `recommended` · `saas` · `minimal` · `everything` |
| `--backend <name>` | `nest` · `plain` |
| `--server <name>` | `express` · `fastify` |
| `--db <name>` | `postgres` · `mysql` · `sqlite` |
| `--web <name>` | `vite` · `next` (picked once, at create) |
| `--auth <list>` | `password,google,github,magic-link,two-factor,passkey` |
| `--plugins <list>` | `organizations,admin,api-keys` or `none` |
| `--security <list>` | `cors,helmet,rate-limit` or `none` |
| `--extras <list>` | `email,uploads,queues,i18n,docker,ci` or `none` |
| `--components <where>` | `apps-web` · `packages-ui` |
| `--accent <color>` | one of shadcn's 18 theme colors (`neutral`, `blue`, `emerald`, `violet`, …) |
| `--pm <name>` | `bun` (default) · `pnpm` · `npm` |
| `--template <src>` | your own template: `./folder` or `github:you/your-template[#branch]` |
| `-y`, `--yes` | accept the defaults, ask nothing |
| `--dry-run` | list what would be created, write nothing |
| `--no-install` · `--no-git` · `--no-banner` | skip the install · skip git · skip the logo |
| `--force` | use a folder that isn't empty — its contents are deleted first |

## Inside a project

The CLI is a dev dependency of every project, pinned to the version that made
it (`pnpm klin …`, `bun run klin …` or `npx klin …`):

```bash
pnpm klin generate                            # asks what to make and what to call it
pnpm klin generate resource billing/invoice   # Prisma model + schemas + API + page
pnpm klin generate backend billing/invoice    # controller, service, DTOs, module
pnpm klin generate frontend billing/invoice   # page, route, query hooks, form
pnpm klin add organizations email             # switch modules on later (3-way merged)
pnpm klin remove email                        # …or off
pnpm klin doctor                              # env, database, services, ports, version drift
pnpm klin list                                # every module and what's on
pnpm klin upgrade                             # merge template improvements (experimental)
```

`klin generate` writes skeletons that typecheck and lint as generated: one
example field shows where yours go, and slashes in the name make folders in
every layer. `--url`, `--plural`, `--no-model`, `--no-validation`,
`--no-route`, `--no-nav` and the `--…-dir` flags shape what's written and
where. `klin --help` lists everything.

## Links

- Full docs: <https://github.com/nata-t/klin#readme>
- Changelog: <https://github.com/nata-t/klin/blob/master/packages/create-klin/CHANGELOG.md>
- Issues: <https://github.com/nata-t/klin/issues>

MIT licensed.
