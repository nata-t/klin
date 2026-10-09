// klin:file queues
import { Logger } from "@nestjs/common"
import { env } from "@repo/env"
import { Redis } from "ioredis"

const logger = new Logger("Jobs")

/**
 * Two Redis connections, following BullMQ's advice:
 *
 * - `queueConnection` is used to *add* jobs (from HTTP requests, auth hooks).
 *   With the offline queue off, `queue.add()` fails fast while Redis is down
 *   instead of hanging the request that called it.
 * - `workerConnection` is used by processors. Workers must wait patiently for
 *   Redis, so retries are unlimited (`maxRetriesPerRequest: null`).
 */
export const queueConnection = new Redis(env.REDIS_URL, { enableOfflineQueue: false })
export const workerConnection = new Redis(env.REDIS_URL, { maxRetriesPerRequest: null })

let down = false

/**
 * ioredis retries forever while Redis is down, and every queue, worker and
 * connection reports each failed attempt. Say it once, and say when it's back.
 */
export function reportRedisError(error: Error) {
  if (down) return
  down = true
  logger.warn(
    `Redis isn't reachable at ${env.REDIS_URL} — background jobs wait until it is (try \`pnpm db:up\`). ${error.message}`
  )
}

for (const connection of [queueConnection, workerConnection]) {
  connection.on("error", reportRedisError)
  connection.on("ready", () => {
    if (down) logger.log("Redis is back — background jobs are running again")
    down = false
  })
}
