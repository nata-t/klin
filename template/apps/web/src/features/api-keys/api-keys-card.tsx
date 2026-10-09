import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { API_KEY_EXPIRY, type CreateApiKeyInput, createApiKeySchema } from "@repo/validators"
import { CopyIcon, KeyRoundIcon, PlusIcon, TrashIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { Skeleton } from "@/components/ui/skeleton"
import { authClient, unwrap } from "@/lib/auth-client"

const apiKeysKey = ["account", "api-keys"] as const
const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })
const DAY = 60 * 60 * 24

/**
 * API keys for scripts and integrations. Send one as the `x-api-key` header
 * and the API treats the request as that user (every guard still applies).
 */
export function ApiKeysCard() {
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [newKey, setNewKey] = useState<string | null>(null)

  const keys = useQuery({
    queryKey: apiKeysKey,
    queryFn: async () => {
      const result = await unwrap(authClient.apiKey.list())
      return Array.isArray(result) ? result : result.apiKeys
    },
  })

  const remove = useMutation({
    mutationFn: (keyId: string) => unwrap(authClient.apiKey.delete({ keyId })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: apiKeysKey }),
    meta: { successMessage: "API key deleted" },
  })

  const form = useAppForm({
    defaultValues: { name: "", expiresIn: "90" } satisfies CreateApiKeyInput as CreateApiKeyInput,
    validators: { onDynamic: createApiKeySchema },
    onSubmit: async ({ value, formApi }) => {
      const created = await unwrap(
        authClient.apiKey.create({
          name: value.name,
          expiresIn: value.expiresIn === "never" ? undefined : Number(value.expiresIn) * DAY,
        })
      )
      await queryClient.invalidateQueries({ queryKey: apiKeysKey })
      formApi.reset()
      setCreating(false)
      setNewKey(created.key)
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>API keys</CardTitle>
        <CardDescription>
          Call the API from scripts: <code className="text-xs">curl -H "x-api-key: …" /api/notes</code>
        </CardDescription>
        <CardAction>
          <Button size="sm" onClick={() => setCreating(true)}>
            <PlusIcon /> New key
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {keys.isPending ? (
          <Skeleton className="h-12" />
        ) : keys.data?.length ? (
          <ul className="divide-y">
            {keys.data.map((key) => (
              <li key={key.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <KeyRoundIcon className="size-5 text-muted-foreground" />
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium">{key.name ?? "Untitled key"}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {key.start ?? key.prefix ?? "••••"}… · {key.expiresAt ? `expires ${dateFormat.format(new Date(key.expiresAt))}` : "never expires"}
                  </p>
                </div>
                <Button variant="ghost" size="icon-sm" aria-label="Delete key" onClick={() => remove.mutate(key.id)}>
                  <TrashIcon />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">No API keys yet.</p>
        )}
      </CardContent>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create an API key</DialogTitle>
          </DialogHeader>
          <AppForm form={form}>
            <FieldGroup>
              <form.AppField name="name">{(field) => <field.TextField label="Name" placeholder="CI deploy script" autoFocus />}</form.AppField>
              <form.AppField name="expiresIn">
                {(field) => (
                  <field.SelectField
                    label="Expires"
                    options={Object.entries(API_KEY_EXPIRY).map(([value, label]) => ({ value, label }))}
                  />
                )}
              </form.AppField>
              <form.AppForm>
                <form.SubmitButton className="self-end">Create key</form.SubmitButton>
              </form.AppForm>
            </FieldGroup>
          </AppForm>
        </DialogContent>
      </Dialog>

      <Dialog open={newKey !== null} onOpenChange={(open) => !open && setNewKey(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save your key</DialogTitle>
            <DialogDescription>This is the only time you'll see it. Store it somewhere safe.</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
            <code className="flex-1 truncate font-mono text-sm">{newKey}</code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                void navigator.clipboard.writeText(newKey ?? "")
                toast.success("Copied to clipboard")
              }}
            >
              <CopyIcon /> Copy
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
