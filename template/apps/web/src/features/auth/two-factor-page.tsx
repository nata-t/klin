// klin:file two-factor
//? "use client" // klin:only next
//? // klin:only next
import { type BackupCodeInput, backupCodeSchema, type TotpCodeInput, totpCodeSchema } from "@repo/validators"
import { ShieldCheckIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { AuthHeader } from "./auth-header"
import { useFinishSignIn } from "./use-finish-sign-in"

/** Second step of sign-in for users with two-factor enabled. */
export function TwoFactorPage() {
  const [useBackupCode, setUseBackupCode] = useState(false)

  return (
    <div className="flex flex-col gap-6">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-brand/10 text-brand">
        <ShieldCheckIcon className="size-6" />
      </div>
      <AuthHeader
        title="Two-factor authentication"
        description={
          useBackupCode
            ? "Enter one of the backup codes you saved when you turned on 2FA."
            : "Enter the 6-digit code from your authenticator app."
        }
      />
      {useBackupCode ? <BackupCodeForm /> : <TotpForm />}
      <Button variant="link" size="sm" className="self-center" onClick={() => setUseBackupCode((v) => !v)}>
        {useBackupCode ? "Use your authenticator app" : "Use a backup code instead"}
      </Button>
    </div>
  )
}

function TotpForm() {
  const finishSignIn = useFinishSignIn()
  const form = useAppForm({
    defaultValues: { code: "", trustDevice: true } satisfies TotpCodeInput as TotpCodeInput,
    validators: { onDynamic: totpCodeSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.twoFactor.verifyTotp(value)
      if (error) {
        toast.error(error.message ?? "That code didn't work")
        return
      }
      await finishSignIn("/dashboard")
    },
  })

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="code">
          {(field) => (
            <field.TextField
              label="Authentication code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              maxLength={6}
              className="text-center font-mono text-lg tracking-[0.5em]"
              autoFocus
            />
          )}
        </form.AppField>
        <form.AppField name="trustDevice">
          {(field) => <field.CheckboxField label="Trust this device for 30 days" />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="w-full">Verify</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}

function BackupCodeForm() {
  const finishSignIn = useFinishSignIn()
  const form = useAppForm({
    defaultValues: { code: "" } satisfies BackupCodeInput as BackupCodeInput,
    validators: { onDynamic: backupCodeSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.twoFactor.verifyBackupCode({ code: value.code })
      if (error) {
        toast.error(error.message ?? "That backup code didn't work")
        return
      }
      await finishSignIn("/dashboard")
    },
  })

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="code">
          {(field) => <field.TextField label="Backup code" autoComplete="one-time-code" className="font-mono" autoFocus />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="w-full">Verify</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}
