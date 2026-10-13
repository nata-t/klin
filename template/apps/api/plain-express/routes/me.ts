import { Router } from "express"
import { ok } from "../lib/http"
import { requireAuth } from "../middleware/auth"

/** GET /api/me — who am I? A tiny example of reading the session. */
export const meRouter = Router()

meRouter.get("/", requireAuth, (req, res) => {
  const { user, session } = res.locals.auth
  res.json(ok(req, { user, session: { id: session.id, expiresAt: session.expiresAt } }))
})
