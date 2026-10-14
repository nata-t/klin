// klin:file password
//? "use client" // klin:only next
//? // klin:only next
import { Link } from "@tanstack/react-router" // klin:only vite
//? import Link from "next/link" // klin:only next
import { type ForgotPasswordInput, forgotPasswordSchema } from "@repo/validators"
import { ArrowLeftIcon, MailCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { AuthHeader } from "./auth-header"

export function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null)

  const form = useAppForm({
    defaultValues: { email: "" } satisfies ForgotPasswordInput as ForgotPasswordInput,
    validators: { onDynamic: forgotPasswordSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.requestPasswordReset({
        email: value.email,
        redirectTo: "/reset-password",
      })
      if (error) {
        toast.error(error.message ?? "Couldn't send the reset link")
        return
      }
      setSentTo(value.email)
    },
  })

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title="Forgot your password?" description="Enter your email and we'll send you a reset link." />
      {sentTo ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border bg-muted/40 p-6 text-center">
          <MailCheckIcon className="size-8 text-brand" />
          <p className="text-sm text-muted-foreground">
            If an account exists for <span className="font-medium text-foreground">{sentTo}</span>, a reset link is on its way.
          </p>
        </div>
      ) : (
        <AppForm form={form}>
          <FieldGroup>
            <form.AppField name="email">
              {(field) => <field.TextField label="Email" type="email" placeholder="you@example.com" autoComplete="email" autoFocus />}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton className="w-full">Send reset link</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </AppForm>
      )}
      <Link to="/sign-in" className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"> {/* klin:only vite */}
      {/*? <Link href="/sign-in" className="inline-flex items-center justify-center gap-1 text-sm text-muted-foreground hover:text-foreground"> */} {/* klin:only next */}
        <ArrowLeftIcon className="size-4" /> Back to sign in
      </Link>
    </div>
  )
}
