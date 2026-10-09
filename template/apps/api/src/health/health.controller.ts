import { Controller, Get, ServiceUnavailableException } from "@nestjs/common"
import { SkipThrottle } from "@nestjs/throttler"
import { Public } from "../common"
import { PrismaService } from "../prisma/prisma.service"

/** GET /api/health — for load balancers, uptime checks and `klin doctor`. */
@Controller("health")
@Public()
@SkipThrottle()
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check() {
    const started = performance.now()
    try {
      await this.prisma.$queryRaw`SELECT 1`
    } catch {
      throw new ServiceUnavailableException({
        code: "DATABASE_UNAVAILABLE",
        message: "Database is unreachable",
      })
    }
    return {
      status: "ok",
      uptime: Math.round(process.uptime()),
      checks: { database: { status: "up", latencyMs: Math.round(performance.now() - started) } },
    }
  }
}
