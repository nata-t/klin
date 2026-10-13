// klin:file admin
import { adminStatsSchema } from "@repo/validators"
import { Router } from "express"
import { ok } from "../lib/http"
import { requireAuth, requireRole } from "../middleware/auth"
import { adminStats } from "../services/admin"

/**
 * /api/admin — users with role "admin" only. User management itself (ban,
 * impersonate, set role) is Better Auth's admin plugin at /api/auth/admin/*.
 */
export const adminRouter = Router()
adminRouter.use(requireAuth, requireRole("admin"))

adminRouter.get("/stats", async (req, res) => {
  res.json(ok(req, adminStatsSchema.parse(await adminStats())))
})
