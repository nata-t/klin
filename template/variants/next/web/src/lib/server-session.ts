import "server-only"
import { createAppAuthClient } from "@repo/auth/client"
import { getSessionCookie } from "better-auth/cookies"
import { headers } from "next/headers"
import { cache } from "react"
import { apiUrl } from "./api-url"

/** Better Auth's client, pointed straight at the API from this server. */
const authClient = createAppAuthClient({ baseURL: apiUrl() })

/**
 * The visitor's session, asked from the API with their cookies — or null.
 * Cached for the request, so layouts and pages can all call it.
 */
export const getServerSession = cache(async () => {
  const incoming = await headers()
  if (!getSessionCookie(incoming)) return null
  const { data } = await authClient.getSession({ fetchOptions: { headers: forwarded(incoming) } })
  return data ?? null
})

/** The visitor's cookie and address, so the API's rate limits and logs see them rather than this server. */
function forwarded(incoming: Headers) {
  const out = new Headers({ cookie: incoming.get("cookie") ?? "" })
  const ip = incoming.get("x-forwarded-for")
  if (ip) out.set("x-forwarded-for", ip)
  return out
}
