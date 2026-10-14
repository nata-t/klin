//? "use client" // klin:only next
//? // klin:only next
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { LaptopIcon, SmartphoneIcon } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient, unwrap } from "@/lib/auth-client"
import { useCurrentSession } from "@/lib/session"

const sessionsKey = ["account", "sessions"] as const
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" })

function describeAgent(userAgent?: string | null) {
  if (!userAgent) return { label: "Unknown device", mobile: false }
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Chrome\//.test(userAgent)
      ? "Chrome"
      : /Firefox\//.test(userAgent)
        ? "Firefox"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : "Browser"
  const os = /Windows/.test(userAgent)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(userAgent)
      ? /iPhone|iPad/.test(userAgent)
        ? "iOS"
        : "macOS"
      : /Android/.test(userAgent)
        ? "Android"
        : /Linux/.test(userAgent)
          ? "Linux"
          : "Unknown OS"
  return { label: `${browser} on ${os}`, mobile: /Mobile|Android|iPhone/.test(userAgent) }
}

export function SessionsCard() {
  const current = useCurrentSession()
  const queryClient = useQueryClient()
  const sessions = useQuery({ queryKey: sessionsKey, queryFn: () => unwrap(authClient.listSessions()) })

  const revoke = useMutation({
    mutationFn: (token: string) => unwrap(authClient.revokeSession({ token })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
    meta: { successMessage: "Signed out of that device" },
  })
  const revokeOthers = useMutation({
    mutationFn: () => unwrap(authClient.revokeOtherSessions()),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: sessionsKey }),
    meta: { successMessage: "Signed out of all other devices" },
  })

  const others = sessions.data?.filter((s) => s.token !== current.session.token) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Active sessions</CardTitle>
        <CardDescription>Devices currently signed in to your account.</CardDescription>
        {others.length > 0 && (
          <CardAction>
            <Button variant="outline" size="sm" disabled={revokeOthers.isPending} onClick={() => revokeOthers.mutate()}>
              Sign out others
            </Button>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        {sessions.isPending ? (
          <Skeleton className="h-16" />
        ) : (
          <ul className="divide-y">
            {sessions.data?.map((session) => {
              const device = describeAgent(session.userAgent)
              const isCurrent = session.token === current.session.token
              const Icon = device.mobile ? SmartphoneIcon : LaptopIcon
              return (
                <li key={session.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <Icon className="size-5 text-muted-foreground" />
                  <div className="min-w-0 flex-1 text-sm">
                    <p className="flex items-center gap-2 font-medium">
                      {device.label}
                      {isCurrent && <Badge variant="secondary">This device</Badge>}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {session.ipAddress || "Unknown IP"} · Signed in {dateFormat.format(new Date(session.createdAt))}
                    </p>
                  </div>
                  {!isCurrent && (
                    <Button variant="ghost" size="sm" disabled={revoke.isPending} onClick={() => revoke.mutate(session.token)}>
                      Sign out
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
