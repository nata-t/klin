// klin:file queues
import { InjectQueue } from "@nestjs/bullmq"
import { Controller, Get, NotFoundException, Param, Post, ServiceUnavailableException } from "@nestjs/common"
import type { Queue } from "bullmq"
import { type AuthUser, CurrentUser } from "../../common"
import { EMAIL_QUEUE, type EmailJob } from "./jobs.constants"

/** /api/jobs — enqueue a demo job and poll its state. */
@Controller("jobs")
export class JobsController {
  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emails: Queue<EmailJob>) {}

  @Post("welcome")
  async enqueueWelcome(@CurrentUser() user: AuthUser) {
    const job = await redis(() => this.emails.add("welcome", { type: "welcome", to: user.email, name: user.name }))
    return { id: job.id }
  }

  @Get(":id")
  async status(@Param("id") id: string) {
    const job = await redis(() => this.emails.getJob(id))
    if (!job) throw new NotFoundException("Job not found")
    return { id: job.id, name: job.name, state: await job.getState(), attempts: job.attemptsMade, result: job.returnvalue }
  }
}

/** Redis being down is a 503, not a 500. */
async function redis<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    throw new ServiceUnavailableException({
      code: "JOBS_UNAVAILABLE",
      message: "Background jobs are unavailable right now. Is Redis running?",
    })
  }
}
