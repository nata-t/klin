import { apiKeyClient } from "@better-auth/api-key/client" // klin:only api-keys
import { passkeyClient } from "@better-auth/passkey/client" // klin:only passkey
import {
  adminClient, // klin:only admin
  inferAdditionalFields,
  magicLinkClient, // klin:only magic-link
  organizationClient, // klin:only organizations
  twoFactorClient, // klin:only two-factor
} from "better-auth/client/plugins"
import { createAuthClient } from "better-auth/react"
import type { auth } from "./auth"
import { ac, roles } from "./permissions" // klin:only organizations

export interface AuthClientOptions {
  /** API origin. Leave undefined to use the current origin (the /api proxy). */
  baseURL?: string
  // klin:if two-factor
  /** Called when a sign-in needs a second factor. */
  onTwoFactorRedirect?: () => void
  // klin:endif
}

/**
 * The typed Better Auth client. Plugin methods (organization.*, twoFactor.*,
 * passkey.*, …) and your additional user fields are all inferred from the
 * server config in ./auth.ts.
 */
export function createAppAuthClient(options: AuthClientOptions = {}) {
  return createAuthClient({
    baseURL: options.baseURL,
    basePath: "/api/auth",
    plugins: [
      inferAdditionalFields<typeof auth>(),
      // klin:if two-factor
      twoFactorClient({ onTwoFactorRedirect: options.onTwoFactorRedirect }),
      // klin:endif
      magicLinkClient(), // klin:only magic-link
      passkeyClient(), // klin:only passkey
      organizationClient({ ac, roles }), // klin:only organizations
      adminClient(), // klin:only admin
      apiKeyClient(), // klin:only api-keys
    ],
  })
}

export type AppAuthClient = ReturnType<typeof createAppAuthClient>
export type ClientSession = AppAuthClient["$Infer"]["Session"]
