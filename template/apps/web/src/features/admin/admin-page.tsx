import { useNavigate } from "@tanstack/react-router"
import {
  BanIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogOutIcon,
  MoreHorizontalIcon,
  SearchIcon,
  ShieldIcon,
  UserCheckIcon,
  UserIcon,
  UsersIcon,
  VenetianMaskIcon,
} from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/layout/user-avatar"
import { PageHeader } from "@/components/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { authClient } from "@/lib/auth-client"
import { refreshSession, useCurrentUser } from "@/lib/session"
import { PAGE_SIZE, useAdminStats, useBanUser, useRevokeUserSessions, useSetRole, useUnbanUser, useUsers } from "./api"

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export function AdminPage() {
  const me = useCurrentUser()
  const navigate = useNavigate()
  const stats = useAdminStats()
  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState("")
  const [search, setSearch] = useState("")
  const users = useUsers(page, search)
  const setRole = useSetRole()
  const banUser = useBanUser()
  const unbanUser = useUnbanUser()
  const revokeSessions = useRevokeUserSessions()

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput)
      setPage(1)
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput])

  async function impersonate(userId: string) {
    const { error } = await authClient.admin.impersonateUser({ userId })
    if (error) return void toast.error(error.message ?? "Couldn't impersonate that user")
    await refreshSession()
    await navigate({ to: "/dashboard" })
  }

  const total = users.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <>
      <PageHeader title="Admin" description="Manage everyone who uses your app." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Users", value: stats.data?.users, icon: UsersIcon },
          { label: "New this week", value: stats.data?.newUsers, icon: UserCheckIcon },
          { label: "Active sessions", value: stats.data?.activeSessions, icon: LogOutIcon },
          { label: "Banned", value: stats.data?.banned, icon: BanIcon },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardHeader>
              <CardDescription className="flex items-center gap-2">
                <stat.icon className="size-4" /> {stat.label}
              </CardDescription>
              <CardTitle className="text-2xl tabular-nums">
                {stat.value === undefined ? <Skeleton className="h-8 w-12" /> : stat.value}
              </CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle>Users</CardTitle>
          <InputGroup className="max-w-xs">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput placeholder="Search by email…" value={searchInput} onChange={(e) => setSearchInput(e.target.value)} />
          </InputGroup>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.isPending
                ? Array.from({ length: 4 }, (_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={5}>
                        <Skeleton className="h-8" />
                      </TableCell>
                    </TableRow>
                  ))
                : users.data?.users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar name={user.name} image={user.image} />
                          <div className="min-w-0">
                            <p className="truncate font-medium">{user.name}</p>
                            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="capitalize">
                          {user.role ?? "user"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {user.banned ? <Badge variant="destructive">Banned</Badge> : <Badge variant="outline">Active</Badge>}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{dateFormat.format(new Date(user.createdAt))}</TableCell>
                      <TableCell>
                        {user.id !== me.id && (
                          <DropdownMenu>
                            <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="User actions" />}>
                              <MoreHorizontalIcon />
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {user.role === "admin" ? (
                                <DropdownMenuItem onClick={() => setRole.mutate({ userId: user.id, role: "user" })}>
                                  <UserIcon /> Make regular user
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem onClick={() => setRole.mutate({ userId: user.id, role: "admin" })}>
                                  <ShieldIcon /> Make admin
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => void impersonate(user.id)}>
                                <VenetianMaskIcon /> Impersonate
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => revokeSessions.mutate(user.id)}>
                                <LogOutIcon /> Sign out everywhere
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {user.banned ? (
                                <DropdownMenuItem onClick={() => unbanUser.mutate(user.id)}>
                                  <UserCheckIcon /> Unban
                                </DropdownMenuItem>
                              ) : (
                                <DropdownMenuItem variant="destructive" onClick={() => banUser.mutate(user.id)}>
                                  <BanIcon /> Ban
                                </DropdownMenuItem>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
            </TableBody>
          </Table>
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>{total} users</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeftIcon /> Previous
              </Button>
              <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                Next <ChevronRightIcon />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
