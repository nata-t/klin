// klin:file queues
import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq"
import { Logger } from "@nestjs/common"
import { env } from "@repo/env"
import type { Job } from "bullmq"
import { sendEmail, WelcomeEmail } from "@repo/email" // klin:only email
import { EMAIL_QUEUE, type EmailJob } from "./jobs.constants"
import { reportRedisError, workerConnection } from "./redis"

/** Runs in the API process. For heavy work, move processors to their own app. */
@Processor(EMAIL_QUEUE, { connection: workerConnection })
export class EmailProcessor extends WorkerHost {
  private readonly logger = new Logger(EmailProcessor.name)

  @OnWorkerEvent("error")
  onError(error: Error) {
    reportRedisError(error)
  }

  @OnWorkerEvent("failed")
  onFailed(job: Job<EmailJob> | undefined, error: Error) {
    this.logger.error(`Job ${job?.name ?? "?"} (${job?.id ?? "?"}) failed: ${error.message}`)
  }

  async process(job: Job<EmailJob>) {
    switch (job.data.type) {
      case "welcome": {
        // klin:if email
        await sendEmail({
          to: job.data.to,
          subject: "Welcome aboard 👋",
          react: WelcomeEmail({ name: job.data.name, url: `${env.WEB_URL}/dashboard` }),
        })
        // klin:else
        this.logger.log(`Would send a welcome email to ${job.data.to} (${env.WEB_URL}/dashboard)`)
        // klin:endif
        return { sent: true }
      }
    }
  }
}
