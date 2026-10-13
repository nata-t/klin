// klin:file queues
import { auth } from "@repo/auth"
import { env } from "@repo/env"
import { type Job, Queue, Worker } from "bullmq"
import { sendEmail, WelcomeEmail } from "@repo/email" // klin:only email
import { serviceUnavailable } from "../lib/http"
import { logger } from "../lib/logger"
import { queueConnection, reportRedisError, workerConnection } from "./redis"

/**
 * Background jobs with BullMQ + Redis: one queue, one worker, running in the
 * API process. Add a queue: copy this file, give it a name, start its worker
 * in main.ts. For heavy work, run the workers in their own process instead.
 */

export const EMAIL_QUEUE = "email"

export type EmailJob = { type: "welcome"; to: string; name: string }

export const emailQueue = new Queue<EmailJob>(EMAIL_QUEUE, {
  // Producers fail fast; the worker brings its own patient connection.
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2_000 },
    removeOnComplete: 1_000,
    removeOnFail: 5_000,
  },
})
emailQueue.on("error", reportRedisError)

async function handle(job: Job<EmailJob>) {
  switch (job.data.type) {
    case "welcome": {
      // klin:if email
      await sendEmail({
        to: job.data.to,
        subject: "Welcome aboard 👋",
        react: WelcomeEmail({ name: job.data.name, url: `${env.WEB_URL}/dashboard` }),
      })
      // klin:else
      logger.info(`Would send a welcome email to ${job.data.to} (${env.WEB_URL}/dashboard)`)
      // klin:endif
      return { sent: true }
    }
  }
}

let worker: Worker<EmailJob> | undefined

/** Starts the worker and queues a welcome email for every new user. */
export function startEmailJobs() {
  worker = new Worker<EmailJob>(EMAIL_QUEUE, handle, { connection: workerConnection })
  worker.on("error", reportRedisError)
  worker.on("failed", (job, error) => {
    logger.error(`Job ${job?.name ?? "?"} (${job?.id ?? "?"}) failed: ${error.message}`)
  })

  // Better Auth database hook (needs `databaseHooks: {}` in packages/auth/src/auth.ts).
  // Sign-up doesn't wait on Redis: if the job can't be queued, the account still exists.
  Object.assign(auth.options.databaseHooks!, {
    user: {
      create: {
        after: async (user: { email: string; name: string }) => {
          emailQueue
            .add("welcome", { type: "welcome", to: user.email, name: user.name })
            .catch((error: Error) => logger.warn(`Couldn't queue the welcome email for ${user.email}: ${error.message}`))
        },
      },
    },
  })
}

export async function stopEmailJobs() {
  await worker?.close()
  await emailQueue.close()
}

/** Redis being down is a 503, not a 500. */
export async function withRedis<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn()
  } catch {
    throw serviceUnavailable("JOBS_UNAVAILABLE", "Background jobs are unavailable right now. Is Redis running?")
  }
}
