# Working in this repository

Notes for AI coding assistants (and humans in a hurry).

## Layout

<!-- klin:if nest-express -->
- `apps/api` — NestJS 12 on Express (ESM, bundled with tsup). Feature modules in `src/modules/<feature>`.
<!-- klin:elif nest-fastify -->
- `apps/api` — NestJS 12 on Fastify (ESM, bundled with tsup). Feature modules in `src/modules/<feature>`.
<!-- klin:elif express -->
- `apps/api` — Express 5 (ESM, bundled with tsup). `src/app.ts` wires everything; routes in `src/routes/<feature>.ts`, logic in `src/services/<feature>.ts`.
<!-- klin:else -->
- `apps/api` — Fastify 5 (ESM, bundled with tsup). `src/app.ts` wires everything; route plugins in `src/routes/<feature>.ts`, logic in `src/services/<feature>.ts`.
<!-- klin:endif -->
<!-- klin:if next -->
- `apps/web` — Next.js 16 (App Router) + React 19. Pages in `src/app` (route groups `(public)`, `(auth)`, `(app)`), feature code in `src/features/<feature>`.
<!-- klin:else -->
- `apps/web` — Vite + React 19. Routes in `src/routes` (TanStack Router, file-based), feature code in `src/features/<feature>`.
<!-- klin:endif -->
<!-- klin:if packages-ui -->
- `packages/ui` — shadcn/ui components, hooks, `cn()` and the global stylesheet/theme (`@repo/ui`).
<!-- klin:endif -->
- `packages/validators` — Zod schemas used by **both** apps. Change data shapes here first.
- `packages/db` — Prisma schema split by domain in `prisma/models/*.prisma`.
- `packages/auth` — Better Auth server config (`auth.ts`) and typed client (`client.ts`).
- `packages/env` — server env schema; add new variables here and to `.env.example`.
- `packages/docs` — architecture and how-to guides.

## Conventions

- Types come from schemas: `z.infer<typeof schema>` (parsed output) and `z.input<typeof schema>` (form values). Don't hand-write data types.
<!-- klin:if nest -->
- Validate with nestjs-zod: `class CreateThingDto extends createZodDto(createThingSchema) {}` in `<feature>.dto.ts`, then
  `@Body() input: CreateThingDto` / `@Query() query: ThingListQueryDto`. Shape responses with `@ZodSerializerDto(ThingDto)`.
  All schemas come from `@repo/validators`.
- Every API route requires a session unless marked `@Public()`. Use `@CurrentUser("id")` for the user id.
- Inject `PrismaService` for database access. Paginated lists return `paginate(items, total, query)`.
<!-- klin:elif express -->
- Validate at the edge with the shared schemas: `createThingSchema.parse(req.body)` (a ZodError becomes a 422),
  and respond with `res.json(ok(req, thingSchema.parse(thing)))` so private fields never leak.
- Routes opt in to auth: `router.use(requireAuth)`; the session is `res.locals.auth`. Throw `notFound()` / `forbidden()` from `src/lib/http.ts`.
- Services are plain functions using `prisma` from `@repo/db`. Paginated lists return `paginate(items, total, query)`.
<!-- klin:else -->
- Route schemas are the shared Zod schemas: `{ schema: { body: createThingSchema, querystring: thingListQuerySchema } }`
  types `request.body`/`request.query`; respond with `ok(request, thingSchema.parse(thing))` so private fields never leak.
- Routes opt in to auth: `app.addHook("preHandler", requireAuth)`; the session is `request.auth`. Throw `notFound()` / `forbidden()` from `src/lib/http.ts`.
- Services are plain functions using `prisma` from `@repo/db`. Paginated lists return `paginate(items, total, query)`.
<!-- klin:endif -->
<!-- klin:if next -->
- Next.js: `page.tsx` files and layouts are server components — keep them thin (metadata, a session check, one feature component).
  Feature pages start with `"use client"`. Server code talks to the API with the visitor's cookie (`lib/server-session.ts`);
  it never imports `@repo/db`. A new signed-in page also goes in the `matcher` of `src/proxy.ts`.
<!-- klin:endif -->
- Web data access goes through `features/<feature>/api.ts`: a query-key factory, `queryOptions`, and hooks.
  Invalidate with the factory (`noteKeys.lists()`).
- Forms use `useAppForm` from `@/components/form` with `validators: { onDynamic: <schema> }`.
<!-- klin:if packages-ui -->
- UI components come from `@repo/ui/components/*` (shadcn/ui on Base UI; use `render={<Link />}` instead of `asChild`).
<!-- klin:else -->
- UI components come from `@/components/ui` (shadcn/ui on Base UI; use `render={<Link />}` instead of `asChild`).
<!-- klin:endif -->
  Add more with `pnpm ui:add <component>`.
- Code style: Prettier (no semicolons, double quotes). Conventional commits.

## Commands

- `pnpm klin generate <resource|backend|frontend> <name>` scaffolds the files and wiring for a new feature (slashes make folders: `billing/invoice`). Prefer it for new CRUD resources, then fill in the fields and logic it leaves as TODOs.
- `pnpm typecheck && pnpm lint && pnpm test` before finishing a change.
- After editing `prisma/models`: `pnpm db:migrate --name <change>`.
- Keep the `klin-anchor:*` comments: the klin CLI inserts code above them.
