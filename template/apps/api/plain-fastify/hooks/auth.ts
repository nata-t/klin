import { auth, type AuthSession } from "@repo/auth"
import { fromNodeHeaders } from "better-auth/node"
import type { FastifyPluginAsync, FastifyRequest } from "fastify"
import { forbidden, unauthorized } from "../lib/http"

declare module "fastify" {
  interface FastifyRequest {
    /** The signed-in user's session — set by `requireAuth`. */
    auth: AuthSession
  }
}

/**
 * Better Auth's handler, registered under /api/auth. Fastify has already parsed
 * the body, so the request is rebuilt as a standard Fetch Request for it.
 */
export const authRoutes: FastifyPluginAsync = async (app) => {
  app.route({
    method: ["GET", "POST"],
    url: "/*",
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`)
      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers: fromNodeHeaders(request.headers),
          ...(request.body != null && { body: JSON.stringify(request.body) }),
        })
      )
      reply.status(response.status)
      response.headers.forEach((value, key) => void reply.header(key, value))
      return reply.send(response.body ? await response.text() : null)
    },
  })
}

/**
 * Requires a session (cookie or, with API keys on, an `x-api-key` header).
 * Afterwards `request.auth.user` is the signed-in user.
 *
 *   app.addHook("preHandler", requireAuth)
 */
export async function requireAuth(request: FastifyRequest) {
  const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) })
  if (!session) throw unauthorized()
  request.auth = session
}

/**
 * Only users whose role is one of `roles` (after `requireAuth`).
 *
 *   app.addHook("preHandler", requireRole("admin"))
 */
export const requireRole =
  (...roles: string[]) =>
  async (request: FastifyRequest) => {
    const userRoles = String(request.auth.user.role ?? "").split(",").map((role) => role.trim())
    if (!userRoles.some((role) => roles.includes(role))) throw forbidden()
  }
// klin:if organizations

/** The session must have an active organization (after `requireAuth`). */
export async function requireActiveOrg(request: FastifyRequest) {
  if (!request.auth.session.activeOrganizationId) throw forbidden("Pick an organization first")
}

/** The member's role in the active organization must be one of `roles`. */
export const requireOrgRole =
  (...roles: string[]) =>
  async (request: FastifyRequest) => {
    const member = await auth.api.getActiveMember({ headers: fromNodeHeaders(request.headers) })
    if (!member || !roles.includes(member.role)) throw forbidden()
  }

/**
 * The member must have these permissions — see packages/auth/src/permissions.ts.
 *
 *   { preHandler: requirePermission({ project: ["read"] }) }
 */
export const requirePermission =
  (permissions: Record<string, string[]>) =>
  async (request: FastifyRequest) => {
    const result = await auth.api.hasPermission({ headers: fromNodeHeaders(request.headers), body: { permissions } })
    if (!result.success) throw forbidden()
  }
// klin:endif
