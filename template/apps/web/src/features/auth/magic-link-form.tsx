// klin:file magic-link
import { type MagicLinkInput, magicLinkSchema } from "@repo/validators"
import { MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"

/** Passwordless: email a one-time sign-in link. Also creates the account on first use. */
export function MagicLinkForm({ callbackURL }: { callbackURL: string }) {
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { email: "" } satisfies MagicLinkInput as MagicLinkInput,
    validators: { onDynamic: magicLinkSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.signIn.magicLink({ email: value.email, callbackURL })
      if (error) {
        toast.error(error.message ?? "Couldn't send the link")
        return
      }
      setSentTo(value.email)
    },
  })

  if (sentTo) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-6 text-center">
        <MailCheckIcon className="size-8 text-brand" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a sign-in link to <span className="font-medium text-foreground">{sentTo}</span>. It expires in 5 minutes.
        </p>
      </div>
    )
  }

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" placeholder="you@example.com" autoComplete="email" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="w-full">Email me a sign-in link</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}
