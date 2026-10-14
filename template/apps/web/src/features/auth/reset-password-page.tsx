// klin:file password
//? "use client" // klin:only next
//? // klin:only next
// klin:if next
//? import Link from "next/link"
//? import { useRouter, useSearchParams } from "next/navigation"
// klin:else
import { getRouteApi, Link, useNavigate } from "@tanstack/react-router"
// klin:endif
import { type ResetPasswordInput, resetPasswordSchema } from "@repo/validators"
import { TriangleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { AuthHeader } from "./auth-header"

const route = getRouteApi("/_auth/reset-password") // klin:only vite

export function ResetPasswordPage() {
  // klin:if next
  //? // Better Auth sends people here with ?token=… (or ?error=INVALID_TOKEN).
  //? const searchParams = useSearchParams()
  //? const token = searchParams.get("token")
  //? const error = searchParams.get("error")
  //? const router = useRouter()
  // klin:else
  const { token, error } = route.useSearch()
  const navigate = useNavigate()
  // klin:endif

  const form = useAppForm({
    defaultValues: { password: "", confirmPassword: "" } satisfies ResetPasswordInput as ResetPasswordInput,
    validators: { onDynamic: resetPasswordSchema },
    onSubmit: async ({ value }) => {
      const result = await authClient.resetPassword({ newPassword: value.password, token: token! })
      if (result.error) {
        toast.error(result.error.message ?? "Couldn't reset your password")
        return
      }
      toast.success("Password updated — sign in with your new password")
      await navigate({ to: "/sign-in" }) // klin:only vite
      //? router.push("/sign-in") // klin:only next
    },
  })

  if (!token || error) {
    return (
      <div className="flex flex-col items-center gap-4 text-center">
        <TriangleAlertIcon className="size-8 text-destructive" />
        <AuthHeader title="This link has expired" description="Reset links work once and expire after an hour." />
        <Button render={<Link to="/forgot-password" />}>Request a new link</Button> {/* klin:only vite */}
        {/*? <Button render={<Link href="/forgot-password" />}>Request a new link</Button> */} {/* klin:only next */}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title="Choose a new password" description="Make it at least 8 characters." />
      <AppForm form={form}>
        <FieldGroup>
          <form.AppField name="password">
            {(field) => <field.PasswordField label="New password" autoComplete="new-password" autoFocus />}
          </form.AppField>
          <form.AppField name="confirmPassword">
            {(field) => <field.PasswordField label="Confirm password" autoComplete="new-password" />}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton className="w-full">Update password</form.SubmitButton>
          </form.AppForm>
        </FieldGroup>
      </AppForm>
    </div>
  )
}
