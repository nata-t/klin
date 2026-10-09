// klin:file organizations
import { createAccessControl } from "better-auth/plugins/access"
import {
  adminAc,
  defaultStatements,
  memberAc,
  ownerAc,
} from "better-auth/plugins/organization/access"

/**
 * Organization RBAC — shared by the API and the web app.
 *
 * 1. Add a resource and its actions to `statements`.
 * 2. Grant actions to each role below.
 * 3. Check them:
 *      API → @MemberHasPermission({ permissions: { project: ["delete"] } })
 *      Web → authClient.organization.checkRolePermission({ role, permissions })
 */
export const statements = {
  ...defaultStatements,
  project: ["create", "read", "update", "delete"],
} as const

export const ac = createAccessControl(statements)

export const member = ac.newRole({
  ...memberAc.statements,
  project: ["create", "read", "update"],
})

export const admin = ac.newRole({
  ...adminAc.statements,
  project: ["create", "read", "update", "delete"],
})

export const owner = ac.newRole({
  ...ownerAc.statements,
  project: ["create", "read", "update", "delete"],
})

export const roles = { member, admin, owner }
