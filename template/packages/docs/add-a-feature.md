# Add a feature

`klin generate` writes the files and the wiring for a new feature: the Zod
schemas, the Prisma model, the API endpoints, the query hooks and a page, all
connected. You add the fields and the logic.

```bash
pnpm klin generate                            # pick what to make, then name it
pnpm klin generate resource project           # every layer
pnpm klin generate backend billing/invoice    # just the API (and its schemas)
pnpm klin generate frontend billing/invoice   # just the web feature (and its schemas)
```

| Generator | Alias | What you get |
| --- | --- | --- |
| `resource` | `r` | A Prisma model, the schemas, the API and the web feature, wired end to end |
<!-- klin:if nest -->
| `backend` | `b`, `api` | A controller with the five REST endpoints, a service, nestjs-zod DTOs and a module registered in `app.module.ts`, plus the schemas |
<!-- klin:else -->
| `backend` | `b`, `api` | Routes for the five REST endpoints, mounted in `src/app.ts`, and a service, plus the schemas |
<!-- klin:endif -->
| `frontend` | `f`, `web` | A page and its route, TanStack Query hooks for the API, a form and a sidebar entry, plus the schemas |

**Folders.** Slashes in the name become folders, the same way in every layer.
`billing/invoice` lands in
<!-- klin:if nest -->
`apps/api/src/modules/billing/invoice/`,
<!-- klin:else -->
`apps/api/src/routes/billing/invoice.ts`,
<!-- klin:endif -->
`apps/web/src/features/billing/invoice/` and
`packages/validators/src/billing/invoice.ts`, and answers on
`/api/billing/invoice`. A folder that's already there is reused, so a second
`billing/payment` goes next to it.

**Shared schemas.** The backend and frontend generators share the schema file:
generate the frontend first and the backend later (or the other way around)
and the second one reuses what's there.

**Flags** change what gets written:

| Flag | Does |
| --- | --- |
| `--url <path>` | Serves it on `/api/<path>` and the page on `/<path>`; the folders stay as named. `pnpm klin generate resource blog/post --url articles` |
| `--plural <word>` | For when the guessed plural is wrong: `pnpm klin generate resource criterion --plural criteria` |
| `--no-model` | A resource without a Prisma model; its service is left to fill in, like a backend module's |
| `--no-validation` | Writes nothing in `packages/validators`, for schemas that already exist. The generated code still imports them by name (`createPostSchema`, `postSchema`, …) and says which are missing |
| `--no-route` | No route file for the page (render it wherever you like) — and so no sidebar entry |
| `--no-nav` | No sidebar entry |
| `--dry-run` · `--force` | Show the plan without writing · overwrite generated files that exist (never the shared schema file) |
| `--backend-dir` · `--frontend-dir` · `--validation-dir` · `--model-dir` | Put this run's files in other folders (see below) |

**Where files go.** Each layer has a folder, and the name's folders nest inside it:

| Layer | klin's default | Has to stay inside |
| --- | --- | --- |
<!-- klin:if nest -->
| Backend | `apps/api/src/modules` (a folder per module) | `apps/api/src` |
<!-- klin:else -->
| Backend | `apps/api/src` (which holds `routes/` and `services/`) | `apps/api/src` |
<!-- klin:endif -->
| Frontend | `apps/web/src/features` | `apps/web/src`, but not `routes/` (every file there becomes a route; the route file itself always goes in `routes/_app`) |
| Validation | `packages/validators/src` | `packages/validators/src` |
| Prisma models | `packages/db/prisma/models` | `packages/db/prisma`, but not `migrations/` |

`pnpm klin generate` asks "Where should it go?" with these folders filled in —
Enter keeps them — and one-line runs take `--frontend-dir apps/web/src/pages`
and the like. Folders are written from the project root, without `..`, and are
checked before anything is written.

To change the defaults for the project, run `pnpm klin generate paths` (or pick
"Change default paths", or tick "Use these from now on" while generating). In a
script: `pnpm klin generate paths --frontend-dir apps/web/src/pages`, and
`--reset` for klin's own. They're saved in `klin.json`:

```json
"generate": { "paths": { "frontend": "apps/web/src/pages" } }
```

## 1. Generate the slice

Let's build **Projects**, where every user keeps a list of projects with a
budget.

```bash
pnpm klin generate resource project
```

That writes and wires up:

| Layer | File | What it is |
| --- | --- | --- |
| Schema | `packages/validators/src/project.ts` | create/update/list/response schemas and their types, exported from the index |
| Database | `packages/db/prisma/models/project.prisma` | the `Project` model: `id`, `name` and timestamps |
<!-- klin:if nest -->
| API | `apps/api/src/modules/project/*` | module, nestjs-zod DTOs, controller (`/api/project`) and a service with the basic queries; registered in `app.module.ts` |
<!-- klin:else -->
| API | `apps/api/src/routes/project.ts` + `src/services/project.ts` | routes (`/api/project`) validated with the shared schemas, and service functions with the basic queries; mounted in `src/app.ts` |
<!-- klin:endif -->
| Data | `apps/web/src/features/project/api.ts` | `projectKeys`, query options, `useProjects`, `useCreateProject`, `useUpdateProject`, `useDeleteProject` |
| UI | `apps/web/src/features/project/*` | a page that lists projects and a form to create one |
| Route | `apps/web/src/routes/_app/project.tsx` | `/project`, with the list preloaded |
| Nav | `apps/web/src/config/nav.ts` | a sidebar entry |

The name you type is used as-is for folders and URLs — `projects` gives you
`/api/projects` — and the schemas, DTOs and model always get the singular
(`projectSchema`, `ProjectDto`, `Project`).

`name` is an example field, wired through every layer so you can see where
yours go. Run it as it is:

```bash
pnpm db:migrate --name add-project
pnpm dev
```

Open <http://localhost:5173/project> and create one.

## 2. Add your fields

A field lives in four places. Add `budget`:

**The schemas** in `packages/validators/src/project.ts` — what clients send,
and what the API returns:

```ts
const projectFields = {
  name: z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters"),
  budget: z.number().int().min(0, "Budget can't be negative").optional(),
}

export const projectSchema = z.object({
  id: idSchema,
  name: z.string(),
  budget: z.number().int().nullable(),
  createdAt: isoDate(),
  updatedAt: isoDate(),
})
```

**The model** in `packages/db/prisma/models/project.prisma`:

```prisma
  name      String
  budget    Int?
```

**The form** in `apps/web/src/features/project/project-form.tsx`:

```tsx
budget: project?.budget ?? undefined,

<form.AppField name="budget">
  {(field) => <field.NumberField label="Budget" step={1} />}
</form.AppField>
```

**The page** shows whatever you pick from `item`. Then
`pnpm db:migrate --name add-project-budget`. The API rejects a negative budget
with a 422, and the form shows the same message before it ever sends.

## 3. Make it yours

**Keep records per user.** Add the owner to the model (and
`projects Project[]` to `User` in `auth.prisma`):

```prisma
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
```

<!-- klin:if nest -->
…then pass the signed-in user from the controller to the service, and use it
in every query:

```ts
// project.controller.ts
@Get()
@ZodSerializerDto(ProjectListDto)
list(@CurrentUser("id") userId: string, @Query() query: ProjectListQueryDto) {
  return this.projects.list(userId, query)
}

// project.service.ts
const where: Prisma.ProjectWhereInput = { userId }
// …and findFirst({ where: { id, userId } }), create({ data: { ...input, userId } })
```
<!-- klin:elif express -->
…then pass the signed-in user (`res.locals.auth.user.id`) from the routes to
the service, and use it in every query:

```ts
// src/routes/project.ts
const list = await projects.listProjects(res.locals.auth.user.id, query)

// src/services/project.ts
const where: Prisma.ProjectWhereInput = { userId }
// …and findFirst({ where: { id, userId } }), create({ data: { ...input, userId } })
```
<!-- klin:else -->
…then pass the signed-in user (`request.auth.user.id`) from the routes to the
service, and use it in every query:

```ts
// src/routes/project.ts
const list = await projects.listProjects(request.auth.user.id, request.query)

// src/services/project.ts
const where: Prisma.ProjectWhereInput = { userId }
// …and findFirst({ where: { id, userId } }), create({ data: { ...input, userId } })
```
<!-- klin:endif -->

**Search.** The list query already takes `?search=`; use it in the service's
`where`:

```ts
...(query.search && { name: contains(query.search) }),
```

<!-- klin:if nest -->
**Add an endpoint.** Controllers are plain Nest, with DTOs from nestjs-zod:

```ts
@Post(":id/archive")
@ZodSerializerDto(ProjectDto)
archive(@Param("id") id: string) {
  return this.projects.archive(id)
}
```
<!-- klin:elif express -->
**Add an endpoint.** Routes are plain Express:

```ts
projectRouter.post("/:id/archive", async (req, res) => {
  const project = await projects.archiveProject(idSchema.parse(req.params.id))
  res.json(ok(req, projectSchema.parse(project)))
})
```
<!-- klin:else -->
**Add an endpoint.** Routes are plain Fastify, with Zod route schemas:

```ts
app.post("/:id/archive", { schema: { params } }, async (request) => {
  const project = await projects.archiveProject(request.params.id)
  return ok(request, projectSchema.parse(project))
})
```
<!-- klin:endif -->

…and a hook next to the others in `features/project/api.ts`:

```ts
export function useArchiveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Project>(`/project/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
    meta: { successMessage: "Archived" },
  })
}
```

<!-- klin:if nest -->
**Restrict it.** Every route needs a signed-in user already; `@Public()` opens
one up. Admin-only? Put `@Roles("admin")` on the controller or the method.
<!-- klin:if organizations -->
Org permission-based? Add a `project` resource to
`packages/auth/src/permissions.ts` and use `@MemberHasPermission(…)`.
<!-- klin:endif -->
<!-- klin:else -->
**Restrict it.** Every route needs a signed-in user already. Admin-only? Add
`requireRole("admin")` after `requireAuth`.
<!-- klin:if organizations -->
Org permission-based? Add a `project` resource to
`packages/auth/src/permissions.ts` and use `requirePermission(…)`.
<!-- klin:endif -->
<!-- klin:endif -->

## Just the backend, or just the frontend

`pnpm klin generate backend <name>` writes the API without a Prisma model, so
its service can't know where the data lives: each method answers
`501 Not Implemented` until you fill it in. The file starts with an
`eslint-disable` line for the arguments the stubs don't use yet — delete it
once they do.

`pnpm klin generate frontend <name>` writes hooks that call `/api/<name>`, the
five endpoints a backend from `klin generate backend <name>` answers. Until
something answers there, the page shows the error.

## 4. Test it

Add a schema test next to the schema (`project.test.ts`, see `note.test.ts`)
and an end-to-end flow in `apps/web/e2e`. See [testing](./testing.md).

## Doing it by hand

The generator only writes files you could write yourself. The Notes example
<!-- klin:if nest -->
(`note.ts`, `note.prisma`, `modules/notes`, `features/notes`,
<!-- klin:else -->
(`note.ts`, `note.prisma`, `routes/notes.ts`, `services/notes.ts`, `features/notes`,
<!-- klin:endif -->
`routes/_app/notes.tsx`) is a finished one to compare with. The `klin-anchor`
comments mark where new imports, modules, routes and nav items go.
