import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query"
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
  queryClient.setQueryData(["session"], null)
  if (!window.location.pathname.startsWith("/sign-in")) {
    const redirect = encodeURIComponent(window.location.pathname + window.location.search)
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
export const queryClient = new QueryClient({
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
