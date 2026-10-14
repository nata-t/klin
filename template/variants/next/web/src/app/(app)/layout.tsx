import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { AppShell } from "@/components/layout/app-shell"
import { getServerSession } from "@/lib/server-session"

/**
 * The signed-in app. proxy.ts already sent visitors without a session cookie
 * to /sign-in; this asks the API whether the session is real, then hands it to
 * the browser's query cache so the shell renders with the user right away.
 */
export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getServerSession()
  if (!session) redirect("/sign-in")

  const queryClient = new QueryClient()
  // sessionQueryKey — lib/session.ts holds client hooks, so it can't be imported here.
  queryClient.setQueryData(["session"], session)
  // The sidebar remembers whether it was collapsed (shadcn's sidebar_state cookie).
  const sidebarOpen = (await cookies()).get("sidebar_state")?.value !== "false"

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AppShell sidebarOpen={sidebarOpen}>{children}</AppShell>
    </HydrationBoundary>
  )
}
