import { MutationCache, QueryCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query" // klin:only vite
//? import { isServer, MutationCache, QueryCache, QueryClient, type QueryClientConfig } from "@tanstack/react-query" // klin:only next
import { toast } from "sonner"
import { errorMessage, isApiError } from "./api-error"

declare module "@tanstack/react-query" {
  interface Register {
    queryMeta: {
      /** Don't toast when this query fails (handle it in the UI instead). */
      silent?: boolean
    }
    mutationMeta: {
      silent?: boolean
      /** Toast this when the mutation succeeds. */
      successMessage?: string
    }
  }
}

function handleUnauthorized(error: unknown) {
  if (!isApiError(error) || error.status !== 401) return false
  // Session expired or was revoked elsewhere: drop it and go sign in again.
  queryClient.setQueryData(["session"], null) // klin:only vite
  //? getQueryClient().setQueryData(["session"], null) // klin:only next
  if (!window.location.pathname.startsWith("/sign-in")) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
    // klin:if next
    //? // A full page load on purpose: it starts the signed-out visit from scratch.
    //? // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    // klin:endif
    window.location.assign(`/sign-in?redirect=${redirect}`)
  }
  return true
}

/**
 * Query conventions:
 * - Keys come from a per-feature factory (see features/notes/api.ts → noteKeys)
 *   so invalidation is one line: `invalidateQueries({ queryKey: noteKeys.lists() })`.
 * - Errors toast automatically; opt out with `meta: { silent: true }`.
 * - Mutations can toast success with `meta: { successMessage: "Saved" }`.
 */
const config = (): QueryClientConfig => ({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (count, error) => {
        if (isApiError(error) && error.status >= 400 && error.status < 500) return false
        return count < 2
      },
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      if (handleUnauthorized(error) || query.meta?.silent) return
      toast.error(errorMessage(error))
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      if (handleUnauthorized(error) || mutation.meta?.silent) return
      toast.error(errorMessage(error))
    },
    onSuccess: (_data, _variables, _context, mutation) => {
      if (mutation.meta?.successMessage) toast.success(mutation.meta.successMessage)
    },
  }),
})

// klin:if next
//? let browserQueryClient: QueryClient | undefined
//?
//? /**
//?  * A fresh client for every request on the server, so one visitor's data never
//?  * reaches another — and one client for the whole visit in the browser.
//?  */
//? export function getQueryClient() {
//?   if (isServer) return new QueryClient(config())
//?   return (browserQueryClient ??= new QueryClient(config()))
//? }
// klin:else
export const queryClient = new QueryClient(config())
// klin:endif
