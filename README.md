<div align="center">

```
██╗  ██╗██╗     ██╗███╗   ██╗
██║ ██╔╝██║     ██║████╗  ██║
█████╔╝ ██║     ██║██╔██╗ ██║
██╔═██╗ ██║     ██║██║╚██╗██║
██║  ██╗███████╗██║██║ ╚████║
╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝
```

**A spotless full-stack TypeScript starter.**
NestJS · Better Auth · Prisma · TanStack Router/Query/Form · shadcn/ui · Turborepo

```bash
npm create klin@latest
```

<img src="./demo/demo.gif" alt="create-klin in action" width="720" />

</div>

---

## Why klin

Most projects spend their first month building the same thing: auth, an API
skeleton, validation, a dashboard shell, CI, Docker. klin hands you that month,
already wired together, and then stays useful after day one.

**The opinion:** one Zod schema should describe a piece of data *everywhere*.
It validates the form, validates the request, shapes the response and gives
both apps their types. klin is built around that idea. Schemas live in
`packages/validators`, NestJS 12 consumes them natively (Standard Schema, no DTO
classes), and the generator writes whole features on top of it.

**It's a good fit for** SaaS products, internal tools, dashboards and API-backed
apps where a separate backend (NestJS) is a feature, not overhead.

**It's not for** static sites, content-heavy marketing sites that need SSR/SEO,
or projects that want everything in one Next.js app. Use a framework built for
that instead.

## What you get

| | |
| --- | --- |
| **Auth** (Better Auth) | sign up/in/out, verify email, forgot/reset password, sessions page · Google · GitHub · magic links · 2FA (TOTP + backup codes) · passkeys · guarded routes on both sides |
| **API** (NestJS 12) | global auth guard + `@Public()` `@Roles()` `@CurrentUser()` · Zod validation & response schemas · one error envelope · pino logs with request ids · rate limiting · helmet · health check · seed script |
| **Web** (Vite + React 19) | public / auth / dashboard layouts · TanStack Router `beforeLoad` guards · typed API client + query-key conventions · TanStack Form + shadcn/ui form kit · dark mode · error, 404 & loading states |
| **Monorepo** | Turborepo with caching and `db:*` tasks · shared TS/ESLint/Prettier configs · husky + lint-staged + commitlint · Vitest + Playwright |
| **Ops** | Docker Compose for local services · production Dockerfiles (API + nginx web) · GitHub Actions · Renovate · `.env` with generated secrets |
| **Optional modules** | organizations & RBAC · admin dashboard · API keys · transactional email (Resend + React Email) · file uploads (S3/R2 presigned) · background jobs (BullMQ) · i18n |
| **Docs** | getting started, architecture, the shared-validators flow, add-a-feature walkthrough, testing, deployment, upgrading |

Pick Postgres, MySQL or SQLite, and pnpm, bun or npm. Unused code is stripped,
not left behind as dead flags.

## The CLI

### Create

```bash
npm create klin@latest            # interactive: presets or pick everything
pnpm create klin my-app --preset saas --db postgres --pm pnpm
bunx create-klin my-app --auth password,google,passkey --plugins organizations --extras email,docker,ci -y
```

It scaffolds the project, strips what you didn't pick, writes `.env` with
fresh secrets, runs `git init`, installs dependencies, generates the Prisma
client, commits, and prints your next steps.

Presets: `recommended` · `saas` · `minimal` (SQLite, no Docker) · `everything`.

### Grow

Inside a project, `pnpm klin` (or `npx create-klin`) gives you:

```bash
pnpm klin generate resource project name:string budget:int? due:date? status:enum:draft,active,done
```

**One command writes a full vertical slice:** the Zod schemas in
`packages/validators`, a Prisma model (with the relation to `User` or the
active organization), a Nest module/controller/service, TanStack Query hooks
with key conventions, a form, a list page with search and pagination, a route,
and a sidebar entry. Everything is wired, typechecks, and works after
`pnpm db:migrate`.

```bash
pnpm klin add organizations email   # bolt modules on later
pnpm klin remove email              # …or take them out
pnpm klin doctor                    # env, database, services, version drift
pnpm klin list                      # what's available, what's on
pnpm klin upgrade                   # merge template improvements (experimental)
```

## How it works

### The template is a real project

[`template/`](./template) is a complete monorepo with every module switched on.
Code that belongs to a module is marked with comments, in whatever syntax the
file uses:

```ts
import { organization } from "better-auth/plugins/organization" // klin:only organizations

// klin:if postgres
provider: "postgresql",
// klin:elif sqlite
//? provider: "sqlite",
// klin:endif
```

The CLI evaluates those markers against your answers and strips the rest.
Modules, prompts, presets and strip rules are all declared in
[`template/klin.template.json`](./template/klin.template.json). The CLI itself
is a generic engine, so **you can fork the template**, add your own modules,
and point the CLI at it:

```bash
npm create klin@latest my-app -- --template github:you/your-klin-template
```

See [CONTRIBUTING.md](./CONTRIBUTING.md#template-authoring) for the marker
reference.

### Upgrades without a framework package

Scaffolded code can't be `npm update`d, so klin records what it generated in
`klin.json` (version + options) and uses **3-way merges** for every later change:

- `klin add` / `klin remove` render the template with your old options and
  with the new ones, then merge the difference into your code. Files you never
  touched are replaced. Files you edited are merged, and only real conflicts
  get markers.
- `klin upgrade` does the same between the template version you started from
  and the latest one.

Dependencies stay fresh with Renovate, in the template here and in every
generated project (grouped updates, a 3-day release-age gate, automerge for
safe ones).

## Develop klin

```bash
pnpm install
pnpm build              # CLI → packages/create-klin/dist, template copied in
pnpm test               # engine, merge, rendering matrix
pnpm playground saas    # render + install a preset into .playground/saas
node packages/create-klin/dist/index.js --help
```

See [CONTRIBUTING.md](./CONTRIBUTING.md) for the layout, the marker reference
and the release process. Changes are tracked in [CHANGELOG.md](./CHANGELOG.md).

## License

MIT
