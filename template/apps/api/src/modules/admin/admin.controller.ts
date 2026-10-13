// klin:file admin
import { Controller, Get } from "@nestjs/common"
import { adminStatsSchema } from "@repo/validators"
import { createZodDto, ZodSerializerDto } from "nestjs-zod"
import { Roles } from "../../common"
import { PrismaService } from "../../prisma/prisma.service"

class AdminStatsDto extends createZodDto(adminStatsSchema) {}

/**
 * /api/admin — only users with role "admin" get in (the whole controller is
 * guarded by @Roles). User management itself (ban, impersonate, set role)
 * comes from Better Auth's admin plugin at /api/auth/admin/*.
 */
@Controller("admin")
@Roles("admin")
export class AdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get("stats")
  @ZodSerializerDto(AdminStatsDto)
  async stats() {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const [users, newUsers, activeSessions, banned] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
      this.prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
      this.prisma.user.count({ where: { banned: true } }),
    ])
    return { users, newUsers, activeSessions, banned }
  }
}
