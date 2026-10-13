import { auth, type AuthSession } from "@repo/auth"
import { fromNodeHeaders } from "better-auth/node"
import type { RequestHandler } from "express"
import { forbidden, unauthorized } from "../lib/http"

declare global {
  // Express types `res.locals` through its global namespace.
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Locals {
      /** The signed-in user's session — set by `requireAuth`. */
      auth: AuthSession
    }
  }
}

/**
 * Requires a session (cookie or, with API keys on, an `x-api-key` header).
 * Afterwards `res.locals.auth.user` is the signed-in user.
 *
 *   router.use(requireAuth)
 */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
  if (!session) throw unauthorized()
  res.locals.auth = session
  next()
}

/**
 * Only users whose role is one of `roles` (after `requireAuth`).
 *
 *   router.use(requireAuth, requireRole("admin"))
 */
export const requireRole =
  (...roles: string[]): RequestHandler =>
  (_req, res, next) => {
    const userRoles = String(res.locals.auth.user.role ?? "").split(",").map((role) => role.trim())
    if (!userRoles.some((role) => roles.includes(role))) throw forbidden()
    next()
  }
// klin:if organizations

/** The session must have an active organization (after `requireAuth`). */
export const requireActiveOrg: RequestHandler = (_req, res, next) => {
  if (!res.locals.auth.session.activeOrganizationId) throw forbidden("Pick an organization first")
  next()
}

/** The member's role in the active organization must be one of `roles`. */
export const requireOrgRole =
  (...roles: string[]): RequestHandler =>
  async (req, _res, next) => {
    const member = await auth.api.getActiveMember({ headers: fromNodeHeaders(req.headers) })
    if (!member || !roles.includes(member.role)) throw forbidden()
    next()
  }

/**
 * The member must have these permissions — see packages/auth/src/permissions.ts.
 *
 *   router.get("/projects", requirePermission({ project: ["read"] }), …)
 */
export const requirePermission =
  (permissions: Record<string, string[]>): RequestHandler =>
  async (req, _res, next) => {
    const result = await auth.api.hasPermission({ headers: fromNodeHeaders(req.headers), body: { permissions } })
    if (!result.success) throw forbidden()
    next()
  }
// klin:endif
