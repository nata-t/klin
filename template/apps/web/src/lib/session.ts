import { queryOptions, useQuery, useQueryClient, useSuspenseQuery } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { authClient } from "./auth-client"
import { queryClient } from "./query-client"

/**
 * The session lives in React Query, so route guards (beforeLoad) and
 * components read the same cached value. Invalidate it after anything that
 * changes the user: sign in/out, profile updates, switching organization.
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
 * The signed-in user. Only use inside the `_app` layout — its guard
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
  return queryClient.invalidateQueries({ queryKey: sessionQueryKey })
}

export function useSignOut() {
  const navigate = useNavigate()
  const client = useQueryClient()
  return async () => {
    await authClient.signOut()
    client.setQueryData(sessionQueryKey, null)
    client.removeQueries({ predicate: (q) => q.queryKey[0] !== "session" })
    await navigate({ to: "/sign-in" })
  }
}

/** Only allow same-origin, path-only redirects (no open redirects). */
export function safeRedirect(target: unknown, fallback = "/dashboard"): string {
  return typeof target === "string" && target.startsWith("/") && !target.startsWith("//")
    ? target
    : fallback
}
