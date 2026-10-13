// klin:file admin
import { adminStatsSchema } from "@repo/validators"
import { requireAuth, requireRole } from "../hooks/auth"
import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"
import { adminStats } from "../services/admin"

/**
 * /api/admin — users with role "admin" only. User management itself (ban,
 * impersonate, set role) is Better Auth's admin plugin at /api/auth/admin/*.
 */
export const adminRoutes: ZodPlugin = async (app) => {
  app.addHook("preHandler", requireAuth)
  app.addHook("preHandler", requireRole("admin"))

  app.get("/stats", async (request) => ok(request, adminStatsSchema.parse(await adminStats())))
}
