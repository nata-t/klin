import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"
import { AppHeader } from "@/components/layout/app-header"
import { AppSidebar } from "@/components/layout/app-sidebar"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { ImpersonationBanner } from "@/features/admin/impersonation-banner" // klin:only admin
import { EmailVerificationBanner } from "@/features/auth/email-verification-banner" // klin:only password
import { sessionQueryOptions } from "@/lib/session"

/**
 * The signed-in app shell. `beforeLoad` is the route guard: no session → off
 * to /sign-in, remembering where you were going.
 */
export const Route = createFileRoute("/_app")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) {
      throw redirect({ to: "/sign-in", search: { redirect: location.href } })
    }
    return { session }
  },
  component: AppLayout,
})

function AppLayout() {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppHeader />
        <ImpersonationBanner /> {/* klin:only admin */}
        <EmailVerificationBanner /> {/* klin:only password */}
        <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 md:p-8">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
