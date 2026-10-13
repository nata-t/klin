import { Router } from "express"
import { ok } from "../lib/http"
import { checkHealth } from "../services/health"

/** GET /api/health — public, and exempt from rate limiting. */
export const healthRouter = Router()

healthRouter.get("/", async (req, res) => {
  res.json(ok(req, await checkHealth()))
})
