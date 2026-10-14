// klin:file two-factor
//? "use client" // klin:only next
//? // klin:only next
import { type ConfirmPasswordInput, confirmPasswordSchema, type TotpCodeInput, totpCodeSchema } from "@repo/validators"
import { CopyIcon, ShieldCheckIcon, ShieldOffIcon } from "lucide-react"
import { useState } from "react"
import QRCode from "react-qr-code"
import { toast } from "sonner"
import { AppForm, useAppForm } from "@/components/form"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { authClient } from "@/lib/auth-client"
import { refreshSession, useCurrentUser } from "@/lib/session"

type Setup = { totpURI: string; backupCodes: string[] }

export function TwoFactorCard() {
  const user = useCurrentUser()
  const enabled = Boolean(user.twoFactorEnabled)
  const [step, setStep] = useState<"closed" | "password" | "verify" | "disable">("closed")
  const [setup, setSetup] = useState<Setup | null>(null)

  const close = () => {
    setStep("closed")
    setSetup(null)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Two-factor authentication
          {enabled ? <Badge>On</Badge> : <Badge variant="outline">Off</Badge>}
        </CardTitle>
        <CardDescription>Require a code from an authenticator app when you sign in.</CardDescription>
        <CardAction>
          {enabled ? (
            <Button variant="outline" size="sm" onClick={() => setStep("disable")}>
              <ShieldOffIcon /> Turn off
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStep("password")}>
              <ShieldCheckIcon /> Turn on
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent />

      <Dialog open={step !== "closed"} onOpenChange={(open) => !open && close()}>
        <DialogContent>
          {step === "password" && (
            <PasswordStep
              title="Turn on two-factor"
              onSubmit={async (password) => {
                const { data, error } = await authClient.twoFactor.enable({ password })
                if (error || !data || !("totpURI" in data)) return toast.error(error?.message ?? "Couldn't start setup")
                setSetup({ totpURI: data.totpURI, backupCodes: data.backupCodes })
                setStep("verify")
              }}
            />
          )}
          {step === "verify" && setup && <VerifyStep setup={setup} onDone={close} />}
          {step === "disable" && (
            <PasswordStep
              title="Turn off two-factor"
              onSubmit={async (password) => {
                const { error } = await authClient.twoFactor.disable({ password })
                if (error) return toast.error(error.message ?? "Couldn't turn off two-factor")
                await refreshSession()
                toast.success("Two-factor authentication is off")
                close()
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

function PasswordStep({ title, onSubmit }: { title: string; onSubmit: (password: string) => Promise<unknown> }) {
  const form = useAppForm({
    defaultValues: { password: "" } satisfies ConfirmPasswordInput as ConfirmPasswordInput,
    validators: { onDynamic: confirmPasswordSchema },
    onSubmit: ({ value }) => onSubmit(value.password),
  })
  return (
    <>
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription>Confirm your password to continue.</DialogDescription>
      </DialogHeader>
      <AppForm form={form}>
        <FieldGroup>
          <form.AppField name="password">
            {(field) => <field.PasswordField label="Password" autoComplete="current-password" autoFocus />}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton className="self-end">Continue</form.SubmitButton>
          </form.AppForm>
        </FieldGroup>
      </AppForm>
    </>
  )
}

function VerifyStep({ setup, onDone }: { setup: Setup; onDone: () => void }) {
  const form = useAppForm({
    defaultValues: { code: "", trustDevice: false } satisfies TotpCodeInput as TotpCodeInput,
    validators: { onDynamic: totpCodeSchema },
    onSubmit: async ({ value }) => {
      const { error } = await authClient.twoFactor.verifyTotp({ code: value.code })
      if (error) return void toast.error(error.message ?? "That code didn't work")
      await refreshSession()
      toast.success("Two-factor authentication is on 🎉")
      onDone()
    },
  })

  return (
    <>
      <DialogHeader>
        <DialogTitle>Scan with your authenticator</DialogTitle>
        <DialogDescription>Then enter the 6-digit code it shows. Save the backup codes somewhere safe.</DialogDescription>
      </DialogHeader>
      <div className="mx-auto rounded-xl bg-white p-3">
        <QRCode value={setup.totpURI} size={168} />
      </div>
      <div className="rounded-lg border bg-muted/40 p-3">
        <div className="mb-2 flex items-center justify-between text-xs font-medium text-muted-foreground">
          Backup codes
          <Button
            variant="ghost"
            size="xs"
            onClick={() => {
              void navigator.clipboard.writeText(setup.backupCodes.join("\n"))
              toast.success("Backup codes copied")
            }}
          >
            <CopyIcon /> Copy
          </Button>
        </div>
        <div className="grid grid-cols-2 gap-1 font-mono text-xs">
          {setup.backupCodes.map((code) => (
            <span key={code}>{code}</span>
          ))}
        </div>
      </div>
      <AppForm form={form}>
        <FieldGroup>
          <form.AppField name="code">
            {(field) => (
              <field.TextField label="Code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="123456" />
            )}
          </form.AppField>
          <form.AppForm>
            <form.SubmitButton className="self-end">Verify & turn on</form.SubmitButton>
          </form.AppForm>
        </FieldGroup>
      </AppForm>
    </>
  )
}
