# create-klin

Scaffold a spotless full-stack TypeScript monorepo: a **NestJS 12** or plain
**Express / Fastify** API, **Better Auth**, **Prisma**, **TanStack
Router/Query/Form** and **shadcn/ui**, with one set of Zod schemas shared by the
API and the web app.

```bash
npm create klin@latest
pnpm create klin
bun create klin
```

A six-step, full-screen wizard (grayscale, keyboard-driven) lets you pick the
backend (NestJS or plain, Express or Fastify), a database (Postgres, MySQL,
SQLite), sign-in methods (email/password, Google, GitHub, magic links, 2FA,
passkeys), Better Auth plugins (organizations, admin, API keys), API safeguards
(CORS, Helmet, rate limiting), extras (email, uploads, queues, i18n, Docker,
CI), where shadcn/ui lives and a theme color. Unused code is stripped, `.env`
gets fresh secrets, dependencies are installed and git is initialized.

Inside a project:

```bash
pnpm klin generate resource project name:string budget:int? due:date?
pnpm klin add organizations email
pnpm klin remove email
pnpm klin doctor
pnpm klin list
```

`create-klin --help` lists every flag. Full docs:
<https://github.com/klin-dev/klin>.
