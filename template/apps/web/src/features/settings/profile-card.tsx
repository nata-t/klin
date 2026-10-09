import { type UpdateProfileInput, updateProfileSchema } from "@repo/validators"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { UserAvatar } from "@/components/layout/user-avatar" // klin:only !uploads
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { AvatarUpload } from "@/features/uploads/avatar-upload" // klin:only uploads
import { authClient } from "@/lib/auth-client"
import { refreshSession, useCurrentUser } from "@/lib/session"

export function ProfileCard() {
  const user = useCurrentUser()

  const form = useAppForm({
    defaultValues: { name: user.name } satisfies UpdateProfileInput as UpdateProfileInput,
    validators: { onDynamic: updateProfileSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.updateUser({ name: value.name })
      if (error) {
        toast.error(error.message ?? "Couldn't update your profile")
        return
      }
      await refreshSession()
      toast.success("Profile updated")
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile</CardTitle>
        <CardDescription>How you appear across the app.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <AvatarUpload /> {/* klin:only uploads */}
        <UserAvatar name={user.name} image={user.image} className="size-16 text-lg" /> {/* klin:only !uploads */}
        <AppForm form={form}>
          <FieldGroup>
            <form.AppField name="name">{(field) => <field.TextField label="Name" autoComplete="name" />}</form.AppField>
            <Field>
              <FieldLabel htmlFor="email" className="flex items-center gap-2">
                Email
                {user.emailVerified ? <Badge variant="secondary">Verified</Badge> : <Badge variant="outline">Unverified</Badge>}
              </FieldLabel>
              <Input id="email" value={user.email} disabled />
            </Field>
            <form.AppForm>
              <form.SubmitButton className="self-start">Save changes</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </AppForm>
      </CardContent>
    </Card>
  )
}
