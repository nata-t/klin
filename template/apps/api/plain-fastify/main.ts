import { prisma } from "@repo/db"
import { env } from "@repo/env"
import { buildApp } from "./app"
import { startEmailJobs, stopEmailJobs } from "./jobs/email" // klin:only queues
import { ensureBucket } from "./services/uploads" // klin:only uploads

startEmailJobs() // klin:only queues
void ensureBucket() // klin:only uploads

const app = await buildApp()
await app.listen({ port: env.API_PORT, host: "0.0.0.0" })
app.log.info(`✨ API ready → http://localhost:${env.API_PORT}/api`)

// Finish in-flight requests, then let go of the database (and Redis).
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, async () => {
    await app.close()
    await stopEmailJobs() // klin:only queues
    await prisma.$disconnect()
    process.exit(0)
  })
}
