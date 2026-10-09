# Working in this repository

Notes for AI coding assistants (and humans in a hurry).

## Layout

- `apps/api` — NestJS 12 (ESM, bundled with tsup). Feature modules in `src/modules/<feature>`.
- `apps/web` — Vite + React 19. Routes in `src/routes` (TanStack Router, file-based), feature code in `src/features/<feature>`.
- `packages/validators` — Zod schemas used by **both** apps. Change data shapes here first.
- `packages/db` — Prisma schema split by domain in `prisma/models/*.prisma`.
- `packages/auth` — Better Auth server config (`auth.ts`) and typed client (`client.ts`).
- `packages/env` — server env schema; add new variables here and to `.env.example`.
- `packages/docs` — architecture and how-to guides.

## Conventions

- Validate requests with `@Body({ schema })` / `@Query({ schema })` and shape responses with
  `@ResponseSchema(schema)`, all using schemas from `@repo/validators`. No DTO classes.
- Every API route requires a session unless marked `@Public()`. Use `@CurrentUser("id")` for the user id.
- Inject `PrismaService` for database access. Paginated lists return `paginate(items, total, query)`.
- Web data access goes through `features/<feature>/api.ts`: a query-key factory, `queryOptions`, and hooks.
  Invalidate with the factory (`noteKeys.lists()`).
- Forms use `useAppForm` from `@/components/form` with `validators: { onDynamic: <schema> }`.
- UI components come from `@/components/ui` (shadcn/ui on Base UI; use `render={<Link />}` instead of `asChild`).
- Code style: Prettier (no semicolons, double quotes). Conventional commits.

## Commands

- `pnpm klin generate resource <name> field:type…` scaffolds a full vertical slice. Prefer it for new CRUD resources.
- `pnpm typecheck && pnpm lint && pnpm test` before finishing a change.
- After editing `prisma/models`: `pnpm db:migrate --name <change>`.
- Keep the `klin-anchor:*` comments: the klin CLI inserts code above them.
