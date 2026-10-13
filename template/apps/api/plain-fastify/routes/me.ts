import { requireAuth } from "../hooks/auth"
import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"

/** GET /api/me — who am I? A tiny example of reading the session. */
export const meRoutes: ZodPlugin = async (app) => {
  app.addHook("preHandler", requireAuth)

  app.get("/", async (request) => {
    const { user, session } = request.auth
    return ok(request, { user, session: { id: session.id, expiresAt: session.expiresAt } })
  })
}
