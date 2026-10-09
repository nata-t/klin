// klin:file password
import { type SignUpInput, signUpSchema } from "@repo/validators"
import { MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { useFinishSignIn } from "./use-finish-sign-in"

export function SignUpForm({ redirectTo }: { redirectTo: string }) {
  const finishSignIn = useFinishSignIn()
  const [verifyEmail, setVerifyEmail] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { name: "", email: "", password: "", confirmPassword: "" } satisfies SignUpInput as SignUpInput,
    validators: { onDynamic: signUpSchema },
    onSubmit: async ({ value }) => {
      const { data, error } = await authClient.signUp.email({
        name: value.name,
        email: value.email,
        password: value.password,
        callbackURL: redirectTo,
      })
      if (error) {
        toast.error(error.message ?? "Couldn't create your account")
        return
      }
      // No token means the server wants the email verified before signing in.
      if (!data?.token) {
        setVerifyEmail(value.email)
        return
      }
      toast.success("Welcome aboard! 🎉")
      await finishSignIn(redirectTo)
    },
  })

  if (verifyEmail) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-6 text-center">
        <MailCheckIcon className="size-8 text-brand" />
        <p className="font-medium">Check your inbox</p>
        <p className="text-sm text-muted-foreground">
          We sent a verification link to <span className="font-medium text-foreground">{verifyEmail}</span>.
        </p>
      </div>
    )
  }

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="name">
          {(field) => <field.TextField label="Name" placeholder="Ada Lovelace" autoComplete="name" autoFocus />}
        </form.AppField>
        <form.AppField name="email">
          {(field) => <field.TextField label="Email" type="email" placeholder="you@example.com" autoComplete="email" />}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField label="Password" autoComplete="new-password" description="At least 8 characters." />
          )}
        </form.AppField>
        <form.AppField name="confirmPassword">
          {(field) => <field.PasswordField label="Confirm password" autoComplete="new-password" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="w-full">Create account</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}
