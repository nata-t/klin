import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { AdminStats } from "@repo/validators"
import { api } from "@/lib/api-client"
import { authClient, unwrap } from "@/lib/auth-client"

export const PAGE_SIZE = 10

export const adminKeys = {
  all: ["admin"] as const,
  stats: () => [...adminKeys.all, "stats"] as const,
  users: (page: number, search: string) => [...adminKeys.all, "users", { page, search }] as const,
}

/** Our own API endpoint (GET /api/admin/stats), guarded by @Roles("admin"). */
export const adminStatsQueryOptions = queryOptions({
  queryKey: adminKeys.stats(),
  queryFn: ({ signal }) => api.get<AdminStats>("/admin/stats", undefined, signal),
})

/** Better Auth's admin plugin API. */
export const usersQueryOptions = (page: number, search: string) =>
  queryOptions({
    queryKey: adminKeys.users(page, search),
    queryFn: () =>
      unwrap(
        authClient.admin.listUsers({
          query: {
            limit: PAGE_SIZE,
            offset: (page - 1) * PAGE_SIZE,
            sortBy: "createdAt",
            sortDirection: "desc",
            ...(search && { searchValue: search, searchField: "email", searchOperator: "contains" }),
          },
        })
      ),
    placeholderData: keepPreviousData,
  })

export const useAdminStats = () => useQuery(adminStatsQueryOptions)
export const useUsers = (page: number, search: string) => useQuery(usersQueryOptions(page, search))

function useInvalidateAdmin() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: adminKeys.all })
}

export function useSetRole() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (input: { userId: string; role: "admin" | "user" }) => unwrap(authClient.admin.setRole(input)),
    onSuccess: invalidate,
    meta: { successMessage: "Role updated" },
  })
}

export function useBanUser() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (userId: string) => unwrap(authClient.admin.banUser({ userId, banReason: "Banned by an admin" })),
    onSuccess: invalidate,
    meta: { successMessage: "User banned" },
  })
}

export function useUnbanUser() {
  const invalidate = useInvalidateAdmin()
  return useMutation({
    mutationFn: (userId: string) => unwrap(authClient.admin.unbanUser({ userId })),
    onSuccess: invalidate,
    meta: { successMessage: "User unbanned" },
  })
}

export function useRevokeUserSessions() {
  return useMutation({
    mutationFn: (userId: string) => unwrap(authClient.admin.revokeUserSessions({ userId })),
    meta: { successMessage: "Signed the user out everywhere" },
  })
}
