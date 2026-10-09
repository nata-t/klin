import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { sessionQueryOptions } from "@/lib/session"

/** After any successful sign-in: load the fresh session, then go where the user was heading. */
export function useFinishSignIn() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  return async (redirectTo: string) => {
    await queryClient.fetchQuery({ ...sessionQueryOptions, staleTime: 0 })
    await navigate({ href: redirectTo, replace: true })
  }
}
