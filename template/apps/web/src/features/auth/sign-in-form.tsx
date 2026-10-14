// klin:file password
import { Link } from "@tanstack/react-router" // klin:only vite
//? import Link from "next/link" // klin:only next
import { type SignInInput, signInSchema } from "@repo/validators"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { useFinishSignIn } from "./use-finish-sign-in"

export function SignInForm({ redirectTo }: { redirectTo: string }) {
  const finishSignIn = useFinishSignIn()

  const form = useAppForm({
    defaultValues: { email: "", password: "", rememberMe: true } satisfies SignInInput as SignInInput,
    validators: { onDynamic: signInSchema },
    onSubmit: async ({ value }) => {
      const { data, error } = await authClient.signIn.email(value)
      if (error) {
        toast.error(error.message ?? "Couldn't sign you in")
        return
      }
      // With two-factor on, Better Auth redirects to /two-factor instead.
      if (data && "twoFactorRedirect" in data && data.twoFactorRedirect) return
      await finishSignIn(redirectTo)
    },
  })

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="email">
          {(field) => (
            <field.TextField
              label="Email"
              type="email"
              placeholder="you@example.com"
              autoComplete="username webauthn"
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="password">
          {(field) => (
            <field.PasswordField
              label="Password"
              autoComplete="current-password"
              labelAction={
                <Link to="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"> {/* klin:only vite */}
                {/*? <Link href="/forgot-password" className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"> */} {/* klin:only next */}
                  Forgot password?
                </Link>
              }
            />
          )}
        </form.AppField>
        <form.AppField name="rememberMe">
          {(field) => <field.CheckboxField label="Keep me signed in" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="w-full">Sign in</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}
