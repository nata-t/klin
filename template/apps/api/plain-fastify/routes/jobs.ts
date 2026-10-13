// klin:file queues
import { z } from "zod"
import { requireAuth } from "../hooks/auth"
import { emailQueue, withRedis } from "../jobs/email"
import { notFound, ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"

/** /api/jobs — enqueue a demo job and poll its state. */
export const jobsRoutes: ZodPlugin = async (app) => {
  app.addHook("preHandler", requireAuth)

  app.post("/welcome", async (request) => {
    const { email, name } = request.auth.user
    const job = await withRedis(() => emailQueue.add("welcome", { type: "welcome", to: email, name }))
    return ok(request, { id: job.id })
  })

  app.get("/:id", { schema: { params: z.object({ id: z.string() }) } }, async (request) => {
    const job = await withRedis(() => emailQueue.getJob(request.params.id))
    if (!job) throw notFound("Job not found")
    const state = await job.getState()
    return ok(request, { id: job.id, name: job.name, state, attempts: job.attemptsMade, result: job.returnvalue })
  })
}
