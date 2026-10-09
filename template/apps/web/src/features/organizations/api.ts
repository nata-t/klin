import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateOrganizationInput, InviteMemberInput } from "@repo/validators"
import { authClient, unwrap, unwrapNullable } from "@/lib/auth-client"
import { refreshSession } from "@/lib/session"

export const organizationKeys = {
  all: ["organizations"] as const,
  list: () => [...organizationKeys.all, "list"] as const,
  active: () => [...organizationKeys.all, "active"] as const,
  invitation: (id: string) => [...organizationKeys.all, "invitation", id] as const,
}

export const organizationsQueryOptions = queryOptions({
  queryKey: organizationKeys.list(),
  queryFn: () => unwrap(authClient.organization.list()),
})

/** The active organization with its members and invitations (null when none is active). */
export const activeOrganizationQueryOptions = queryOptions({
  queryKey: organizationKeys.active(),
  queryFn: () => unwrapNullable(authClient.organization.getFullOrganization()),
})

export const useOrganizations = () => useQuery(organizationsQueryOptions)
export const useActiveOrganization = () => useQuery(activeOrganizationQueryOptions)

/** Switching organization changes what org-scoped data you see, so refetch everything. */
export function useSetActiveOrganization() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (organizationId: string | null) =>
      unwrapNullable(authClient.organization.setActive({ organizationId })),
    onSuccess: async () => {
      await refreshSession()
      await queryClient.invalidateQueries()
    },
  })
}

export function useCreateOrganization() {
  const setActive = useSetActiveOrganization()
  return useMutation({
    mutationFn: async (input: CreateOrganizationInput) => {
      const organization = await unwrap(authClient.organization.create(input))
      await setActive.mutateAsync(organization.id)
      return organization
    },
    meta: { successMessage: "Organization created" },
  })
}

function useInvalidateActive() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: organizationKeys.active() })
}

export function useInviteMember() {
  const invalidate = useInvalidateActive()
  return useMutation({
    mutationFn: (input: InviteMemberInput) => unwrap(authClient.organization.inviteMember(input)),
    onSuccess: invalidate,
    meta: { successMessage: "Invitation sent" },
  })
}

export function useUpdateMemberRole() {
  const invalidate = useInvalidateActive()
  return useMutation({
    mutationFn: (input: { memberId: string; role: "member" | "admin" | "owner" }) =>
      unwrap(authClient.organization.updateMemberRole(input)),
    onSuccess: invalidate,
    meta: { successMessage: "Role updated" },
  })
}

export function useRemoveMember() {
  const invalidate = useInvalidateActive()
  return useMutation({
    mutationFn: (memberIdOrEmail: string) =>
      unwrap(authClient.organization.removeMember({ memberIdOrEmail })),
    onSuccess: invalidate,
    meta: { successMessage: "Member removed" },
  })
}

export function useCancelInvitation() {
  const invalidate = useInvalidateActive()
  return useMutation({
    mutationFn: (invitationId: string) => unwrap(authClient.organization.cancelInvitation({ invitationId })),
    onSuccess: invalidate,
    meta: { successMessage: "Invitation cancelled" },
  })
}
