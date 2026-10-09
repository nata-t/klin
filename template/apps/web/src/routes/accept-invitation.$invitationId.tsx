import { createFileRoute, redirect } from "@tanstack/react-router"
import { AcceptInvitationPage } from "@/features/organizations/accept-invitation-page"
import { sessionQueryOptions } from "@/lib/session"

/** Where invitation emails link to. Signs you in first if needed, then comes back. */
export const Route = createFileRoute("/accept-invitation/$invitationId")({
  beforeLoad: async ({ context, location }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (!session) throw redirect({ to: "/sign-in", search: { redirect: location.href } })
  },
  staticData: { title: "Invitation" },
  component: AcceptInvitationPage,
})
