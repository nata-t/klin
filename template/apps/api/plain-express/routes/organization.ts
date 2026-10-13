// klin:file organizations
import { organizationOverviewSchema } from "@repo/validators"
import { Router } from "express"
import { ok } from "../lib/http"
import { requireActiveOrg, requireAuth, requireOrgRole, requirePermission } from "../middleware/auth"
import { organizationOverview } from "../services/organization"

/**
 * /api/organization — examples of organization-scoped routes.
 *
 * Creating orgs, inviting and managing members is Better Auth's organization
 * plugin at /api/auth/organization/*. Your own org-scoped data reads
 * `session.activeOrganizationId` like the routes below.
 */
export const organizationRouter = Router()
organizationRouter.use(requireAuth, requireActiveOrg)

/** Any member of the active organization. */
organizationRouter.get("/overview", async (req, res) => {
  const { session, user } = res.locals.auth
  const overview = await organizationOverview(session.activeOrganizationId!, user.id)
  res.json(ok(req, organizationOverviewSchema.parse(overview)))
})

/** Role check: owners and admins only. */
organizationRouter.get("/billing", requireOrgRole("owner", "admin"), (req, res) => {
  res.json(ok(req, { plan: "free", message: "Only owners and admins can see this." }))
})

/** Permission check: uses the access control in packages/auth/src/permissions.ts. */
organizationRouter.get("/projects", requirePermission({ project: ["read"] }), (req, res) => {
  res.json(ok(req, { items: [], message: "Every role with project:read can see this." }))
})
