import { useQueryClient } from "@tanstack/react-query"
// klin:if next
//? import type { Route } from "next"
//? import { useRouter } from "next/navigation"
// klin:else
import { useNavigate } from "@tanstack/react-router"
// klin:endif
import { sessionQueryOptions } from "@/lib/session"

/** After any successful sign-in: load the fresh session, then go where the user was heading. */
export function useFinishSignIn() {
  const navigate = useNavigate() // klin:only vite
  //? const router = useRouter() // klin:only next
  const queryClient = useQueryClient()
  return async (redirectTo: string) => {
    await queryClient.fetchQuery({ ...sessionQueryOptions, staleTime: 0 })
    await navigate({ href: redirectTo, replace: true }) // klin:only vite
    //? router.replace(redirectTo as Route) // klin:only next
  }
}
