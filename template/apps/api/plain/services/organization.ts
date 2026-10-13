// klin:file organizations
import { prisma } from "@repo/db"
import { notFound } from "../lib/http"

/** The active organization at a glance, for any of its members. */
export async function organizationOverview(organizationId: string, userId: string) {
  const [organization, members, pendingInvitations, membership] = await Promise.all([
    prisma.organization.findUnique({ where: { id: organizationId } }),
    prisma.member.count({ where: { organizationId } }),
    prisma.invitation.count({ where: { organizationId, status: "pending" } }),
    prisma.member.findFirst({ where: { organizationId, userId } }),
  ])
  if (!organization || !membership) throw notFound("Organization not found")
  return { organization, members, pendingInvitations, role: membership.role }
}
