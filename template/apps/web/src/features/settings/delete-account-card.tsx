import { useQueryClient } from "@tanstack/react-query"
import { useNavigate } from "@tanstack/react-router"
import { type ConfirmPasswordInput, confirmPasswordSchema } from "@repo/validators" // klin:only password
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form" // klin:only password
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { authClient } from "@/lib/auth-client"

export function DeleteAccountCard() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  async function deleteAccount(password?: string) {
    const { error } = await authClient.deleteUser({ password, callbackURL: "/" })
    if (error) {
      toast.error(error.message ?? "Couldn't delete your account")
      return
    }
    queryClient.clear()
    toast.success("Your account has been deleted")
    await navigate({ to: "/" })
  }

  // klin:if password
  const form = useAppForm({
    defaultValues: { password: "" } satisfies ConfirmPasswordInput as ConfirmPasswordInput,
    validators: { onDynamic: confirmPasswordSchema },
    onSubmit: ({ value }) => deleteAccount(value.password),
  })
  // klin:endif

  return (
    <Card className="border-destructive/30">
      <CardHeader>
        <CardTitle>Delete account</CardTitle>
        <CardDescription>Permanently delete your account and everything in it. This can't be undone.</CardDescription>
      </CardHeader>
      <CardContent>
        <AlertDialog open={open} onOpenChange={setOpen}>
          <AlertDialogTrigger render={<Button variant="destructive" />}>Delete account</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>All of your data will be removed for good.</AlertDialogDescription>
            </AlertDialogHeader>
            {/* klin:if password */}
            <AppForm form={form} className="grid gap-4">
              <form.AppField name="password">
                {(field) => <field.PasswordField label="Confirm with your password" autoComplete="current-password" />}
              </form.AppField>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <form.AppForm>
                  <form.SubmitButton variant="destructive">Delete forever</form.SubmitButton>
                </form.AppForm>
              </AlertDialogFooter>
            </AppForm>
            {/* klin:else */}
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <Button variant="destructive" onClick={() => void deleteAccount()}>
                Delete forever
              </Button>
            </AlertDialogFooter>
            {/* klin:endif */}
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  )
}
