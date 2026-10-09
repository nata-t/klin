// klin:file queues
import { InjectQueue } from "@nestjs/bullmq"
import { Injectable, Logger } from "@nestjs/common"
import { AfterCreate, DatabaseHook } from "@thallesp/nestjs-better-auth"
import type { Queue } from "bullmq"
import { EMAIL_QUEUE, type EmailJob } from "./jobs.constants"

/**
 * Better Auth database hooks, as a Nest provider (so it can inject queues).
 * Needs `databaseHooks: {}` in packages/auth/src/auth.ts — already there.
 */
@Injectable()
@DatabaseHook()
export class SignUpHooks {
  private readonly logger = new Logger(SignUpHooks.name)

  constructor(@InjectQueue(EMAIL_QUEUE) private readonly emails: Queue<EmailJob>) {}

  /**
   * Queue the welcome email without making sign-up wait on Redis. If the job
   * can't be queued, the user still gets their account.
   */
  @AfterCreate("user")
  welcome(user: { email: string; name: string }) {
    this.emails
      .add("welcome", { type: "welcome", to: user.email, name: user.name })
      .catch((error: Error) => this.logger.warn(`Couldn't queue the welcome email for ${user.email}: ${error.message}`))
  }
}
