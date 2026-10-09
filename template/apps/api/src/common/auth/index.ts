import {
  createParamDecorator,
  type ExecutionContext,
  ForbiddenException, // klin:only organizations
  UnauthorizedException,
} from "@nestjs/common"
import type { AuthSession, AuthUser } from "@repo/auth"
import {
  AllowAnonymous,
  OptionalAuth,
  Roles as RequireRoles,
} from "@thallesp/nestjs-better-auth"

/**
 * Auth decorators for controllers. A global guard (from AuthModule) already
 * requires a session on every route; these adjust that per route or class.
 */

/** No session needed (health checks, webhooks, public pages). */
export const Public = AllowAnonymous

/** Session is optional: handler runs either way, `@CurrentUser()` may be null. */
export const Optional = OptionalAuth

/**
 * Restrict to users whose `role` matches one of the given roles.
 *
 *   @Roles("admin")
 */
export const Roles = (...roles: string[]) => RequireRoles(roles)

type AuthedRequest = { session?: AuthSession | null; user?: AuthUser | null }

/**
 * The signed-in user, typed from your Better Auth config.
 *
 *   @Get() list(@CurrentUser() user: AuthUser) {}
 *   @Get() list(@CurrentUser("id") userId: string) {}
 */
export const CurrentUser = createParamDecorator(
  (field: keyof AuthUser | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest<AuthedRequest>()
    const user = request.session?.user ?? request.user
    if (!user) throw new UnauthorizedException("You need to sign in first")
    return field ? user[field] : user
  }
)

// klin:if organizations
/**
 * The active organization's id (org-scoped routes). 403 when none is active —
 * pair it with @RequireActiveOrg() on the controller for a clearer error.
 */
export const ActiveOrganizationId = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  const id = ctx.switchToHttp().getRequest<AuthedRequest>().session?.session.activeOrganizationId
  if (!id) throw new ForbiddenException("Pick an organization first")
  return id
})

// klin:endif
/** The full session ({ session, user }). */
export const CurrentSession = createParamDecorator((_: unknown, ctx: ExecutionContext) => {
  return ctx.switchToHttp().getRequest<AuthedRequest>().session ?? null
})

export type { AuthSession, AuthUser }
export {
  MemberHasPermission, // klin:only organizations
  OrgRoles, // klin:only organizations
  RequireActiveOrg, // klin:only organizations
} from "@thallesp/nestjs-better-auth"
