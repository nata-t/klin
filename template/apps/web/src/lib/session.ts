import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { authClient } from "./auth-client"
import { queryClient } from "./query-client" // klin:only vite
//? import { getQueryClient } from "./query-client" // klin:only next

/**
 * The session lives in React Query, so route guards and components read the
 * same cached value. Invalidate it after anything that changes the user:
 * sign in/out, profile updates, switching organization.
 */
export const sessionQueryKey = ["session"] as const

export const sessionQueryOptions = queryOptions({
  queryKey: sessionQueryKey,
  queryFn: async () => {
    const { data } = await authClient.getSession()
    return data ?? null
  },
  staleTime: 60_000,
})

export type Session = NonNullable<Awaited<ReturnType<NonNullable<typeof sessionQueryOptions.queryFn>>>>
export type User = Session["user"]

/** The session, or null when signed out. */
export function useSession() {
  return useQuery(sessionQueryOptions)
}

/**
 * The signed-in user. Only use inside the signed-in app layout — its guard
 * guarantees a session is already cached.
 */
export function useCurrentUser(): User {
  const { data } = useSuspenseQuery(sessionQueryOptions)
  if (!data) throw new Error("useCurrentUser() must be used inside the signed-in app layout")
  return data.user
}

export function useCurrentSession(): Session {
  const { data } = useSuspenseQuery(sessionQueryOptions)
  if (!data) throw new Error("useCurrentSession() must be used inside the signed-in app layout")
  return data
}

export function refreshSession() {
  return queryClient.invalidateQueries({ queryKey: sessionQueryKey }) // klin:only vite
  //? return getQueryClient().invalidateQueries({ queryKey: sessionQueryKey }) // klin:only next
}

/**
 * Signs out, then loads /sign-in from scratch: nothing from the signed-in
 * visit (cached data, the app shell around the page) outlives it.
 */
export async function signOut() {
  await authClient.signOut()
  // klin:if next
  //? // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  // klin:endif
  window.location.assign("/sign-in")
}

/** Only allow same-origin, path-only redirects (no open redirects). */
export function safeRedirect(target: unknown, fallback = "/dashboard"): string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//")
    ? target
    : fallback
}
