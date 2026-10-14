// klin:file passkey
//? "use client" // klin:only next
//? // klin:only next
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FingerprintIcon, PlusIcon, TrashIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient, unwrap } from "@/lib/auth-client"

const passkeysKey = ["account", "passkeys"] as const
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export function PasskeysCard() {
  const queryClient = useQueryClient()
  const passkeys = useQuery({ queryKey: passkeysKey, queryFn: () => unwrap(authClient.passkey.listUserPasskeys()) })

  const add = useMutation({
    mutationFn: async () => {
      const result = await authClient.passkey.addPasskey({ name: navigator.platform || "Passkey" })
      if (result?.error) throw new Error(result.error.message ?? "Couldn't add a passkey")
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: passkeysKey }),
    meta: { successMessage: "Passkey added" },
  })

  const remove = useMutation({
    mutationFn: (id: string) => unwrap(authClient.passkey.deletePasskey({ id })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: passkeysKey }),
    meta: { successMessage: "Passkey removed" },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Passkeys</CardTitle>
        <CardDescription>Sign in with Face ID, Touch ID, Windows Hello or a security key.</CardDescription>
        <CardAction>
          <Button size="sm" disabled={add.isPending} onClick={() => add.mutate()}>
            <PlusIcon /> Add passkey
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {passkeys.isPending ? (
          <Skeleton className="h-12" />
        ) : passkeys.data?.length ? (
          <ul className="divide-y">
            {passkeys.data.map((passkey) => (
              <li key={passkey.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <FingerprintIcon className="size-5 text-muted-foreground" />
                <div className="flex-1 text-sm">
                  <p className="font-medium">{passkey.name || "Passkey"}</p>
                  <p className="text-xs text-muted-foreground">
                    Added {passkey.createdAt ? dateFormat.format(new Date(passkey.createdAt)) : "recently"}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Remove passkey" onClick={() => remove.mutate(passkey.id)}>
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No passkeys yet.</p>
        )}
      </CardContent>
    </Card>
  )
}
