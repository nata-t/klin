// klin:file organizations
import { Controller, Get, NotFoundException } from "@nestjs/common"
import { organizationOverviewSchema } from "@repo/validators"
import { createZodDto, ZodSerializerDto } from "nestjs-zod"
import {
  type AuthSession,
  CurrentSession,
  MemberHasPermission,
  OrgRoles,
  RequireActiveOrg,
} from "../../common"
import { PrismaService } from "../../prisma/prisma.service"

class OrganizationOverviewDto extends createZodDto(organizationOverviewSchema) {}

/**
 * /api/organization — examples of organization-scoped routes.
 *
 * Creating orgs, inviting and managing members is handled by Better Auth's
 * organization plugin at /api/auth/organization/*. Your own org-scoped data
 * reads `session.activeOrganizationId` like the routes below.
 */
@Controller("organization")
@RequireActiveOrg()
export class OrganizationController {
  constructor(private readonly prisma: PrismaService) {}

  /** Any member of the active organization. */
  @Get("overview")
  @ZodSerializerDto(OrganizationOverviewDto)
  async overview(@CurrentSession() session: AuthSession) {
    const organizationId = session.session.activeOrganizationId!
    const [organization, members, pendingInvitations, membership] = await Promise.all([
      this.prisma.organization.findUnique({ where: { id: organizationId } }),
      this.prisma.member.count({ where: { organizationId } }),
      this.prisma.invitation.count({ where: { organizationId, status: "pending" } }),
      this.prisma.member.findFirst({ where: { organizationId, userId: session.user.id } }),
    ])
    if (!organization || !membership) throw new NotFoundException("Organization not found")
    return { organization, members, pendingInvitations, role: membership.role }
  }

  /** Role check: owners and admins only. */
  @Get("billing")
  @OrgRoles(["owner", "admin"])
  billing() {
    return { plan: "free", message: "Only owners and admins can see this." }
  }

  /** Permission check: uses the access control in packages/auth/src/permissions.ts. */
  @Get("projects")
  @MemberHasPermission({ permissions: { project: ["read"] } })
  projects() {
    return { items: [], message: "Every role with project:read can see this." }
  }
}
