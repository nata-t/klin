import { createAppAuthClient } from "@repo/auth/client"
import { env } from "@/env" // klin:only vite

/**
 * The Better Auth client. Use it for everything auth: sign in/up/out,
 * sessions, and plugin APIs (authClient.organization.*, authClient.admin.*, …).
 */
// klin:if vite || two-factor
export const authClient = createAppAuthClient({
  baseURL: env.VITE_API_URL, // klin:only vite
  // klin:if two-factor
  onTwoFactorRedirect: () => {
    // klin:if next
    //? // There's no router out here, so a full page load takes you to the second step.
    //? // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    // klin:endif
    window.location.assign("/two-factor")
  },
  // klin:endif
})
// klin:else
//? export const authClient = createAppAuthClient()
// klin:endif

type ClientResult<T> = { data: T; error: null } | { data: null; error: { message?: string; status?: number } }

/**
 * Better Auth client calls resolve to `{ data, error }` instead of throwing.
 * `unwrap` turns that into a value-or-throw, which is what React Query wants.
 */
export async function unwrap<T>(promise: Promise<ClientResult<T>>): Promise<NonNullable<T>> {
  const { data, error } = await promise
  if (error) throw new Error(error.message || "Something went wrong")
  if (data === null || data === undefined) throw new Error("The server returned an empty response")
  return data
}

/** Like `unwrap`, but `null` is a valid answer (e.g. "no active organization"). */
export async function unwrapNullable<T>(promise: Promise<ClientResult<T>>): Promise<T | null> {
  const { data, error } = await promise
  if (error) throw new Error(error.message || "Something went wrong")
  return data ?? null
}
