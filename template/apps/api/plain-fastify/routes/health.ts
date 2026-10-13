import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"
import { checkHealth } from "../services/health"

/** GET /api/health — public, and exempt from rate limiting. */
export const healthRoutes: ZodPlugin = async (app) => {
  app.get("/", { config: { rateLimit: false } }, async (request) => ok(request, await checkHealth())) // klin:only rate-limit
  //? app.get("/", async (request) => ok(request, await checkHealth())) // klin:only !rate-limit
}
