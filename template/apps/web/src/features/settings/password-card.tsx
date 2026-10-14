// klin:file password
//? "use client" // klin:only next
//? // klin:only next
import { type ChangePasswordInput, changePasswordSchema } from "@repo/validators"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"

export function PasswordCard() {
  const form = useAppForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
      revokeOtherSessions: true,
    } satisfies ChangePasswordInput as ChangePasswordInput,
    validators: { onDynamic: changePasswordSchema },
    onSubmit: async ({ value, formApi }) => {
      const { error } = await authClient.changePassword({
        currentPassword: value.currentPassword,
        newPassword: value.newPassword,
        revokeOtherSessions: value.revokeOtherSessions,
      })
      if (error) {
        toast.error(error.message ?? "Couldn't change your password")
        return
      }
      formApi.reset()
      toast.success("Password changed")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Password</CardTitle>
        <CardDescription>Use a long, unique password you don't use anywhere else.</CardDescription>
      </CardHeader>
      <CardContent>
        <AppForm form={form}>
          <FieldGroup>
            <form.AppField name="currentPassword">
              {(field) => <field.PasswordField label="Current password" autoComplete="current-password" />}
            </form.AppField>
            <form.AppField name="newPassword">
              {(field) => <field.PasswordField label="New password" autoComplete="new-password" />}
            </form.AppField>
            <form.AppField name="confirmPassword">
              {(field) => <field.PasswordField label="Confirm new password" autoComplete="new-password" />}
            </form.AppField>
            <form.AppField name="revokeOtherSessions">
              {(field) => <field.CheckboxField label="Sign out of all other devices" />}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton className="self-start">Change password</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </AppForm>
      </CardContent>
    </Card>
  )
}
