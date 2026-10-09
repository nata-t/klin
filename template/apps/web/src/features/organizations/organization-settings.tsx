import { type InviteMemberInput, inviteMemberSchema } from "@repo/validators"
import { Building2Icon, MailIcon, PlusIcon, TrashIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { AppForm, useAppForm } from "@/components/form"
import { UserAvatar } from "@/components/layout/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { FieldGroup } from "@/components/ui/field"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { useCurrentUser } from "@/lib/session"
import {
  useActiveOrganization,
  useCancelInvitation,
  useInviteMember,
  useRemoveMember,
  useUpdateMemberRole,
} from "./api"
import { CreateOrganizationDialog } from "./create-organization-dialog"

const ROLE_OPTIONS = [
  { value: "member", label: "Member" },
  { value: "admin", label: "Admin" },
  { value: "owner", label: "Owner" },
] as const

export function OrganizationSettings() {
  const user = useCurrentUser()
  const { data: organization, isPending } = useActiveOrganization()
  const [creating, setCreating] = useState(false)

  if (isPending) return <Skeleton className="h-64" />

  if (!organization) {
    return (
      <Empty className="border border-dashed">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Building2Icon />
          </EmptyMedia>
          <EmptyTitle>You're in your personal workspace</EmptyTitle>
          <EmptyDescription>Create an organization to invite teammates and share work with roles and permissions.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={() => setCreating(true)}>
            <PlusIcon /> Create organization
          </Button>
        </EmptyContent>
        <CreateOrganizationDialog open={creating} onOpenChange={setCreating} />
      </Empty>
    )
  }

  const me = organization.members.find((m) => m.userId === user.id)
  const canManage = me?.role === "owner" || me?.role === "admin"
  const pending = organization.invitations.filter((i) => i.status === "pending")

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>{organization.name}</CardTitle>
          <CardDescription>
            /{organization.slug} · you're {me?.role === "admin" ? "an" : "a"} <strong>{me?.role}</strong>
          </CardDescription>
        </CardHeader>
      </Card>

      <MembersCard organization={organization} currentUserId={user.id} canManage={canManage} />
      {canManage && <InviteCard />}

      {pending.length > 0 && <InvitationsCard invitations={pending} canManage={canManage} />}
    </>
  )
}

type FullOrganization = NonNullable<ReturnType<typeof useActiveOrganization>["data"]>

function MembersCard({
  organization,
  currentUserId,
  canManage,
}: {
  organization: FullOrganization
  currentUserId: string
  canManage: boolean
}) {
  const updateRole = useUpdateMemberRole()
  const removeMember = useRemoveMember()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Members</CardTitle>
        <CardDescription>{organization.members.length} people in this organization.</CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {organization.members.map((member) => (
            <li key={member.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
              <UserAvatar name={member.user.name} image={member.user.image} />
              <div className="min-w-0 flex-1 text-sm">
                <p className="truncate font-medium">
                  {member.user.name} {member.userId === currentUserId && <span className="text-muted-foreground">(you)</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{member.user.email}</p>
              </div>
              {canManage && member.userId !== currentUserId ? (
                <>
                  <Select
                    value={member.role}
                    items={ROLE_OPTIONS}
                    onValueChange={(role) =>
                      updateRole.mutate({ memberId: member.id, role: role as "member" | "admin" | "owner" })
                    }
                  >
                    <SelectTrigger size="sm" className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon-sm" aria-label="Remove member" onClick={() => removeMember.mutate(member.id)}>
                    <TrashIcon />
                  </Button>
                </>
              ) : (
                <Badge variant="secondary" className="capitalize">
                  {member.role}
                </Badge>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}

function InviteCard() {
  const inviteMember = useInviteMember()
  const form = useAppForm({
    defaultValues: { email: "", role: "member" } satisfies InviteMemberInput as InviteMemberInput,
    validators: { onDynamic: inviteMemberSchema },
    onSubmit: async ({ value, formApi }) => {
      await inviteMember.mutateAsync(value)
      formApi.reset()
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invite a teammate</CardTitle>
        <CardDescription>They'll get an email with a link to join.</CardDescription>
      </CardHeader>
      <CardContent>
        <AppForm form={form}>
          <FieldGroup className="sm:flex-row sm:items-start">
            <form.AppField name="email">
              {(field) => <field.TextField label="Email" type="email" placeholder="teammate@example.com" />}
            </form.AppField>
            <form.AppField name="role">
              {(field) => (
                <field.SelectField
                  label="Role"
                  options={[
                    { value: "member", label: "Member" },
                    { value: "admin", label: "Admin" },
                  ]}
                />
              )}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton className="sm:mt-6">
                <MailIcon /> Send invite
              </form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </AppForm>
      </CardContent>
    </Card>
  )
}

function InvitationsCard({
  invitations,
  canManage,
}: {
  invitations: FullOrganization["invitations"]
  canManage: boolean
}) {
  const cancel = useCancelInvitation()
  return (
    <Card>
      <CardHeader>
        <CardTitle>Pending invitations</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="divide-y">
          {invitations.map((invitation) => (
            <li key={invitation.id} className="flex items-center gap-3 py-3 text-sm first:pt-0 last:pb-0">
              <MailIcon className="size-4 text-muted-foreground" />
              <span className="flex-1 truncate">{invitation.email}</span>
              <Badge variant="outline" className="capitalize">
                {invitation.role}
              </Badge>
              {canManage && (
                <Button variant="ghost" size="icon-sm" aria-label="Cancel invitation" onClick={() => cancel.mutate(invitation.id)}>
                  <XIcon />
                </Button>
              )}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
