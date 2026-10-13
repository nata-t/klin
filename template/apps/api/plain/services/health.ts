import { prisma } from "@repo/db"
import { serviceUnavailable } from "../lib/http"

/** GET /api/health — for load balancers, uptime checks and `klin doctor`. */
export async function checkHealth() {
  const started = performance.now()
  try {
    await prisma.$queryRaw`SELECT 1`
  } catch {
    throw serviceUnavailable("DATABASE_UNAVAILABLE", "Database is unreachable")
  }
  return {
    status: "ok",
    uptime: Math.round(process.uptime()),
    checks: { database: { status: "up", latencyMs: Math.round(performance.now() - started) } },
  }
}
