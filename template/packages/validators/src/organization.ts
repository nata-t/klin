// klin:file organizations
import { z } from "zod"
import { emailSchema, slugSchema } from "./common"

export const ORGANIZATION_ROLES = ["member", "admin", "owner"] as const
export type OrganizationRole = (typeof ORGANIZATION_ROLES)[number]

export const createOrganizationSchema = z.object({
  name: z.string().trim().min(2, "Use at least 2 characters").max(60),
  slug: slugSchema,
})
export type CreateOrganizationInput = z.input<typeof createOrganizationSchema>

export const inviteMemberSchema = z.object({
  email: emailSchema,
  role: z.enum(["member", "admin"]),
})
export type InviteMemberInput = z.input<typeof inviteMemberSchema>

export const organizationOverviewSchema = z.object({
  organization: z.object({ id: z.string(), name: z.string(), slug: z.string() }),
  members: z.number().int(),
  pendingInvitations: z.number().int(),
  role: z.string(),
})
export type OrganizationOverview = z.output<typeof organizationOverviewSchema>
