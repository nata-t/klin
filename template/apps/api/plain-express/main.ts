import { prisma } from "@repo/db"
import { env } from "@repo/env"
import { createApp } from "./app"
import { startEmailJobs, stopEmailJobs } from "./jobs/email" // klin:only queues
import { logger } from "./lib/logger"
import { ensureBucket } from "./services/uploads" // klin:only uploads

startEmailJobs() // klin:only queues
void ensureBucket() // klin:only uploads

const server = createApp().listen(env.API_PORT, () => {
  logger.info(`✨ API ready → http://localhost:${env.API_PORT}/api`)
})

// Finish in-flight requests, then let go of the database (and Redis).
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(async () => {
      await stopEmailJobs() // klin:only queues
      await prisma.$disconnect()
      process.exit(0)
    })
  })
}
