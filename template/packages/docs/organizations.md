# Organizations & RBAC

Better Auth's [organization plugin](https://www.better-auth.com/docs/plugins/organization)
gives every user a personal workspace plus any number of organizations, with
invitations and roles.

## In the app

- **Sidebar switcher:** pick the active organization or create one.
- **Settings → Organization:** members, roles, invitations.
- **Invitation links** (`/accept-invitation/:id`) are emailed to invitees.
  They sign in (or up) and accept.

The active organization lives on the session (`session.activeOrganizationId`).

## Roles and permissions

Roles are `owner`, `admin` and `member`. What each can do is defined once in
`packages/auth/src/permissions.ts`, which the API and the web app share:

```ts
export const statements = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
} as const

export const member = ac.newRole({ ...memberAc.statements, project: ["create", "read", "update"] })
```

## Guarding API routes

<!-- klin:if nest -->
```ts
@Controller("organization")
@RequireActiveOrg()                     // 403 unless an org is active
export class OrganizationController {
  @Get("billing")
  @OrgRoles(["owner", "admin"])          // by role
  billing() {}

  @Delete("projects/:id")
  @MemberHasPermission({ permissions: { project: ["delete"] } })  // by permission
  remove() {}
}
```

Read the active organization in a handler with `@ActiveOrganizationId()`.
<!-- klin:elif express -->
```ts
// src/routes/organization.ts
organizationRouter.use(requireAuth, requireActiveOrg)                 // 403 unless an org is active
organizationRouter.get("/billing", requireOrgRole("owner", "admin"), …) // by role
organizationRouter.delete("/projects/:id", requirePermission({ project: ["delete"] }), …) // by permission
```

Read the active organization in a handler from
`res.locals.auth.session.activeOrganizationId`.
<!-- klin:else -->
```ts
// src/routes/organization.ts
app.addHook("preHandler", requireAuth)
app.addHook("preHandler", requireActiveOrg)                              // 403 unless an org is active
app.get("/billing", { preHandler: requireOrgRole("owner", "admin") }, …) // by role
app.delete("/projects/:id", { preHandler: requirePermission({ project: ["delete"] }) }, …) // by permission
```

Read the active organization in a handler from
`request.auth.session.activeOrganizationId`.
<!-- klin:endif -->
Generate org-owned resources with
`pnpm klin generate resource project name:string --scope org`.

## In the web app

```ts
const { data: organization } = useActiveOrganization()  // features/organizations/api.ts
const allowed = authClient.organization.checkRolePermission({
  role: "member",
  permissions: { project: ["delete"] },
})
```
