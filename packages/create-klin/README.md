# create-klin

Scaffold a spotless full-stack TypeScript monorepo: **NestJS 12**, **Better
Auth**, **Prisma**, **TanStack Router/Query/Form** and **shadcn/ui**, with one
set of Zod schemas shared by the API and the web app.

```bash
npm create klin@latest
pnpm create klin
bun create klin
```

Pick sign-in methods (email/password, Google, GitHub, magic links, 2FA,
passkeys), Better Auth plugins (organizations, admin, API keys), a database
(Postgres, MySQL, SQLite) and extras (email, uploads, queues, i18n, Docker,
CI). Unused code is stripped, `.env` gets fresh secrets, dependencies are
installed and git is initialized.

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
