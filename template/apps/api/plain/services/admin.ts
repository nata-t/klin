// klin:file admin
import { prisma } from "@repo/db"

/** Numbers for the admin dashboard. User management itself is Better Auth's (/api/auth/admin/*). */
export async function adminStats() {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const [users, newUsers, activeSessions, banned] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.session.count({ where: { expiresAt: { gt: new Date() } } }),
    prisma.user.count({ where: { banned: true } }),
  ])
  return { users, newUsers, activeSessions, banned }
}
