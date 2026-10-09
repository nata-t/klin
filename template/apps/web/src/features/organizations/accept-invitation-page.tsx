import { useMutation, useQuery } from "@tanstack/react-query"
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router"
import { Building2Icon } from "lucide-react"
import { Logo } from "@/components/logo"
import { PageLoader } from "@/components/page-loader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient, unwrap } from "@/lib/auth-client"
import { refreshSession } from "@/lib/session"
import { organizationKeys } from "./api"

const route = getRouteApi("/accept-invitation/$invitationId")

export function AcceptInvitationPage() {
  const { invitationId } = route.useParams()
  const navigate = useNavigate()

  const invitation = useQuery({
    queryKey: organizationKeys.invitation(invitationId),
    queryFn: () => unwrap(authClient.organization.getInvitation({ query: { id: invitationId } })),
    meta: { silent: true },
  })

  const accept = useMutation({
    mutationFn: async () => {
      await unwrap(authClient.organization.acceptInvitation({ invitationId }))
      await refreshSession()
    },
    onSuccess: () => navigate({ to: "/dashboard" }),
    meta: { successMessage: "Welcome to the team! 🎉" },
  })

  const decline = useMutation({
    mutationFn: () => unwrap(authClient.organization.rejectInvitation({ invitationId })),
    onSuccess: () => navigate({ to: "/dashboard" }),
  })

  return (
    <div className="bg-glow flex min-h-svh flex-col items-center justify-center gap-8 p-6">
      <Logo />
      {invitation.isPending ? (
        <PageLoader label="Loading invitation…" />
      ) : invitation.data ? (
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <div className="mx-auto mb-2 grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
              <Building2Icon className="size-6" />
            </div>
            <CardTitle>Join {invitation.data.organizationName}</CardTitle>
            <CardDescription>
              {invitation.data.inviterEmail} invited you as {invitation.data.role === "admin" ? "an" : "a"} {invitation.data.role}.
            </CardDescription>
          </CardHeader>
          <CardContent />
          <CardFooter className="justify-center gap-2">
            <Button variant="outline" disabled={decline.isPending || accept.isPending} onClick={() => decline.mutate()}>
              Decline
            </Button>
            <Button disabled={accept.isPending || decline.isPending} onClick={() => accept.mutate()}>
              Accept invitation
            </Button>
          </CardFooter>
        </Card>
      ) : (
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <CardTitle>Invitation not found</CardTitle>
            <CardDescription>It may have expired, been cancelled, or been sent to a different email.</CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button render={<Link to="/dashboard" />}>Go to dashboard</Button>
          </CardFooter>
        </Card>
      )}
    </div>
  )
}
