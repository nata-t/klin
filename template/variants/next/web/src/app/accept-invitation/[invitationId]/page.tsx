// klin:file organizations
import type { Metadata } from "next"
import { redirect } from "next/navigation"
import { AcceptInvitationPage } from "@/features/organizations/accept-invitation-page"
import { getServerSession } from "@/lib/server-session"

export const metadata: Metadata = { title: "Invitation" }

/** Where invitation emails link to. Signs you in first if needed, then comes back. */
export default async function Page({ params }: PageProps<"/accept-invitation/[invitationId]">) {
  const { invitationId } = await params
  if (!(await getServerSession())) {
    redirect(`/sign-in?redirect=${encodeURIComponent(`/accept-invitation/${invitationId}`)}`)
  }
  return <AcceptInvitationPage />
}
