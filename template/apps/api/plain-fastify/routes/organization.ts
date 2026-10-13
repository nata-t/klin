// klin:file organizations
import { organizationOverviewSchema } from "@repo/validators"
import { requireActiveOrg, requireAuth, requireOrgRole, requirePermission } from "../hooks/auth"
import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"
import { organizationOverview } from "../services/organization"

/**
 * /api/organization — examples of organization-scoped routes.
 *
 * Creating orgs, inviting and managing members is Better Auth's organization
 * plugin at /api/auth/organization/*. Your own org-scoped data reads
 * `session.activeOrganizationId` like the routes below.
 */
export const organizationRoutes: ZodPlugin = async (app) => {
  app.addHook("preHandler", requireAuth)
  app.addHook("preHandler", requireActiveOrg)

  /** Any member of the active organization. */
  app.get("/overview", async (request) => {
    const { session, user } = request.auth
    const overview = await organizationOverview(session.activeOrganizationId!, user.id)
    return ok(request, organizationOverviewSchema.parse(overview))
  })

  /** Role check: owners and admins only. */
  app.get("/billing", { preHandler: requireOrgRole("owner", "admin") }, async (request) =>
    ok(request, { plan: "free", message: "Only owners and admins can see this." })
  )

  /** Permission check: uses the access control in packages/auth/src/permissions.ts. */
  app.get("/projects", { preHandler: requirePermission({ project: ["read"] }) }, async (request) =>
    ok(request, { items: [], message: "Every role with project:read can see this." })
  )
}
