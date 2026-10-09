// klin:file queues
import { BullModule, InjectQueue } from "@nestjs/bullmq"
import { Module } from "@nestjs/common"
import type { Queue } from "bullmq"
import { EMAIL_QUEUE } from "./jobs.constants"
import { JobsController } from "./jobs.controller"
import { EmailProcessor } from "./email.processor"
import { queueConnection, reportRedisError } from "./redis"
import { SignUpHooks } from "./sign-up.hooks"

/**
 * Background jobs with BullMQ + Redis. Add a queue: register it below, create a
 * processor (see email.processor.ts), inject it with @InjectQueue(name).
 */
@Module({
  imports: [
    BullModule.forRoot({
      // Producers fail fast; processors bring their own patient connection.
      connection: queueConnection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 2_000 },
        removeOnComplete: 1_000,
        removeOnFail: 5_000,
      },
    }),
    BullModule.registerQueue({ name: EMAIL_QUEUE }),
  ],
  controllers: [JobsController],
  providers: [EmailProcessor, SignUpHooks],
})
export class JobsModule {
  constructor(@InjectQueue(EMAIL_QUEUE) emails: Queue) {
    // Queues without an error listener print every reconnect attempt. Attach it
    // as soon as the queue exists, before it has had a chance to fail.
    emails.on("error", reportRedisError)
  }
}
