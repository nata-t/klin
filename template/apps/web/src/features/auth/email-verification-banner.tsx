// klin:file password
import { MailWarningIcon, XIcon } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { useCurrentUser } from "@/lib/session"

/** Nudges users who haven't clicked their verification link yet. */
export function EmailVerificationBanner() {
  const user = useCurrentUser()
  const [dismissed, setDismissed] = useState(false)
  const [sending, setSending] = useState(false)

  if (user.emailVerified || dismissed) return null

  async function resend() {
    setSending(true)
    const { error } = await authClient.sendVerificationEmail({ email: user.email, callbackURL: "/dashboard" })
    setSending(false)
    if (error) toast.error(error.message ?? "Couldn't send the email")
    else toast.success(`Verification email sent to ${user.email}`)
  }

  return (
    <div className="flex items-center gap-3 border-b bg-amber-500/10 px-4 py-2 text-sm text-amber-900 dark:text-amber-200">
      <MailWarningIcon className="size-4 shrink-0" />
      <p className="flex-1">
        Please verify your email address. We sent a link to <strong>{user.email}</strong>.
      </p>
      <Button size="sm" variant="ghost" disabled={sending} onClick={() => void resend()}>
        Resend
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label="Dismiss" onClick={() => setDismissed(true)}>
        <XIcon />
      </Button>
    </div>
  )
}
