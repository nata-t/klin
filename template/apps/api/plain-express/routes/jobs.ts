// klin:file queues
import { Router } from "express"
import { emailQueue, withRedis } from "../jobs/email"
import { notFound, ok } from "../lib/http"
import { requireAuth } from "../middleware/auth"

/** /api/jobs — enqueue a demo job and poll its state. */
export const jobsRouter = Router()
jobsRouter.use(requireAuth)

jobsRouter.post("/welcome", async (req, res) => {
  const { email, name } = res.locals.auth.user
  const job = await withRedis(() => emailQueue.add("welcome", { type: "welcome", to: email, name }))
  res.json(ok(req, { id: job.id }))
})

jobsRouter.get("/:id", async (req, res) => {
  const job = await withRedis(() => emailQueue.getJob(req.params.id))
  if (!job) throw notFound("Job not found")
  const state = await job.getState()
  res.json(ok(req, { id: job.id, name: job.name, state, attempts: job.attemptsMade, result: job.returnvalue }))
})
