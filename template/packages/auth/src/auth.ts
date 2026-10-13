import { prisma } from "@repo/db"
import { env, isProduction } from "@repo/env"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { admin } from "better-auth/plugins/admin" // klin:only admin
import { magicLink } from "better-auth/plugins/magic-link" // klin:only magic-link
import { organization } from "better-auth/plugins/organization" // klin:only organizations
import { twoFactor } from "better-auth/plugins/two-factor" // klin:only two-factor
import { apiKey } from "@better-auth/api-key" // klin:only api-keys
import { passkey } from "@better-auth/passkey" // klin:only passkey
import { sendAuthEmail } from "./emails" // klin:only password || magic-link || organizations
import { ac, roles } from "./permissions" // klin:only organizations

const APP_NAME = "Klin App"

/**
 * Better Auth — the whole auth server. Mounted by the API at /api/auth/*
 * (via @thallesp/nestjs-better-auth on NestJS). Docs: https://www.better-auth.com/docs
 *
 * Cookies: the web app reaches the API through a same-origin /api proxy (Vite
 * in dev, nginx in prod), so session cookies are first-party everywhere and
 * `SameSite=Lax` just works. Deploying the API on another site? See
 * packages/docs/deployment.md → "Separate origins".
 */
export const auth = betterAuth({
  appName: APP_NAME,
  baseURL: env.BETTER_AUTH_URL,
  basePath: "/api/auth",
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: [env.WEB_URL],

  database: prismaAdapter(prisma, {
    // klin:if postgres
    provider: "postgresql",
    // klin:elif mysql
    //? provider: "mysql",
    // klin:elif sqlite
    //? provider: "sqlite",
    // klin:endif
  }),
  // klin:if password

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    // Unverified users can sign in during development; production requires a click.
    requireEmailVerification: isProduction,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendAuthEmail({ type: "reset-password", to: user.email, name: user.name, url })
    },
  },

  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await sendAuthEmail({ type: "verify-email", to: user.email, name: user.name, url })
    },
  },
  // klin:endif
  // klin:if oauth

  // Providers only switch on once their credentials are in .env.
  socialProviders: {
    // klin:if google
    ...(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: env.GOOGLE_CLIENT_ID,
            clientSecret: env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {}),
    // klin:endif
    // klin:if github
    ...(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET
      ? {
          github: {
            clientId: env.GITHUB_CLIENT_ID,
            clientSecret: env.GITHUB_CLIENT_SECRET,
          },
        }
      : {}),
    // klin:endif
  },

  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: [
        "google", // klin:only google
        "github", // klin:only github
      ],
    },
  },
  // klin:endif

  user: {
    // klin:if !admin
    additionalFields: {
      // Used by the @Roles() decorator on the API. The admin plugin manages
      // this field for you if you add it later (`klin add admin`).
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
    },
    // klin:endif
    deleteUser: { enabled: true },
  },

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // refresh the expiry at most once a day
    cookieCache: { enabled: true, maxAge: 5 * 60 },
  },

  advanced: {
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      sameSite: "lax",
      httpOnly: true,
    },
  },

  // klin:if queues
  // klin:if nest
  // Filled in by @DatabaseHook() providers in the API (see apps/api/src/modules/jobs).
  // klin:else
  //? // Filled in by the API at startup (see apps/api/src/jobs/email.ts).
  // klin:endif
  databaseHooks: {},

  // klin:endif
  plugins: [
    // klin:if two-factor
    twoFactor({ issuer: APP_NAME }),
    // klin:endif
    // klin:if magic-link
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendAuthEmail({ type: "magic-link", to: email, url })
      },
    }),
    // klin:endif
    // klin:if passkey
    passkey({
      rpID: new URL(env.WEB_URL).hostname,
      rpName: APP_NAME,
      origin: env.WEB_URL,
    }),
    // klin:endif
    // klin:if organizations
    organization({
      ac,
      roles,
      creatorRole: "owner",
      sendInvitationEmail: async ({ id, email, organization, inviter }) => {
        await sendAuthEmail({
          type: "invitation",
          to: email,
          url: `${env.WEB_URL}/accept-invitation/${id}`,
          organization: organization.name,
          inviter: inviter.user.name,
        })
      },
    }),
    // klin:endif
    // klin:if admin
    admin({ defaultRole: "user", adminRoles: ["admin"] }),
    // klin:endif
    // klin:if api-keys
    // Requests with an `x-api-key` header get a session, so API keys work with
    // every guarded route on the API.
    apiKey({ enableSessionForAPIKeys: true }),
    // klin:endif
  ],
})

export type Auth = typeof auth
export type AuthSession = typeof auth.$Infer.Session
export type AuthUser = AuthSession["user"]
