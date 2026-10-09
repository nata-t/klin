# Add a feature

Let's build **Projects**, where every user keeps a list of projects with a
budget and a due date. One command does most of the work, then we'll make it
ours.

## 1. Generate the vertical slice

```bash
pnpm klin generate resource project name:string description:text? budget:int? due:date? status:enum:planned,active,done
```

> In zsh, quote fields that end with `?`: `'budget:int?'`. Or run
> `pnpm klin generate resource project` with no fields and answer the prompts.

That writes and wires up:

| Layer | File | What it is |
| --- | --- | --- |
| Schema | `packages/validators/src/project.ts` | create/update/list/response schemas + types, exported from the index |
| Database | `packages/db/prisma/models/project.prisma` | `Project` model + a `projects` relation on `User` |
| API | `apps/api/src/modules/projects/*` | module, controller (`/api/projects`), service; registered in `app.module.ts` |
| Data | `apps/web/src/features/projects/api.ts` | `projectKeys`, query options, `useProjects`, `useCreateProject`, … |
| UI | `apps/web/src/features/projects/*` | form, table page with search, pagination, create/edit/delete dialogs |
| Route | `apps/web/src/routes/_app/projects.tsx` | `/projects`, URL-synced search params, data preloaded |
| Nav | `apps/web/src/config/nav.ts` | a sidebar entry |

Field types: `string` `text` `int` `float` `boolean` `date` `datetime`
`enum:a,b,c`. End a field with `?` to make it optional.
<!-- klin:if organizations -->
Add `--scope org` to make the resource belong to the active organization
instead of the user.
<!-- klin:endif -->

## 2. Create the table and look at it

```bash
pnpm db:migrate --name add-projects
pnpm dev
```

Open <http://localhost:5173/projects>. Create, edit, search and delete
already work.

## 3. Make it yours

**Tighten a rule.** In `packages/validators/src/project.ts`:

```ts
budget: z.number().int().min(0, "Budget can't be negative").optional(),
```

The form now shows that message, and the API rejects negative budgets with a
422. No other file changes.

**Add a computed field.** Want `isOverdue` in responses? Add it to
`projectSchema` and return it from the service. The `Project` type, and with it
every component that reads it, picks it up:

```ts
// validators
export const projectSchema = z.object({ …, isOverdue: z.boolean() })

// apps/api/src/modules/projects/projects.service.ts
const withOverdue = (p: ProjectRow) => ({ ...p, isOverdue: !!p.due && p.due < new Date() })
```

**Add an endpoint.** Controllers are plain Nest:

```ts
@Post(":id/archive")
@ResponseSchema(projectSchema)
archive(@CurrentUser("id") userId: string, @Param("id") id: string) {
  return this.projects.update(userId, id, { status: "done" })
}
```

…and a hook next to the others in `features/projects/api.ts`:

```ts
export function useArchiveProject() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Project>(`/projects/${id}/archive`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: projectKeys.lists() }),
    meta: { successMessage: "Archived" },
  })
}
```

**Restrict it.** Admin-only? Put `@Roles("admin")` on the controller or the
method.
<!-- klin:if organizations -->
Org permission-based? Add a `project` resource to
`packages/auth/src/permissions.ts` and use `@MemberHasPermission(…)`.
<!-- klin:endif -->

## 4. Test it

Add a schema test next to the schema (`project.test.ts`, see `note.test.ts`)
and an end-to-end flow in `apps/web/e2e`. See [testing](./testing.md).

## Doing it by hand

The generator only writes files you could write yourself. The Notes example
(`note.ts`, `note.prisma`, `modules/notes`, `features/notes`,
`routes/_app/notes.tsx`) is the reference to copy from. The `klin-anchor`
comments mark where new imports, modules and nav items go.
