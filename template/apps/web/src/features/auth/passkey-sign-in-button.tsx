// klin:file passkey
import { FingerprintIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { useFinishSignIn } from "./use-finish-sign-in"

export function PasskeySignInButton({ redirectTo }: { redirectTo: string }) {
  const finishSignIn = useFinishSignIn()
  const [pending, setPending] = useState(false)

  // Offer saved passkeys right in the email field's autofill (where supported).
  useEffect(() => {
    if (!window.PublicKeyCredential?.isConditionalMediationAvailable) return
    void window.PublicKeyCredential.isConditionalMediationAvailable().then(async (available) => {
      if (!available) return
      const result = await authClient.signIn.passkey({ autoFill: true })
      if (!result?.error) await finishSignIn(redirectTo)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function signIn() {
    setPending(true)
    const result = await authClient.signIn.passkey()
    setPending(false)
    if (result?.error) {
      toast.error(result.error.message ?? "Passkey sign-in was cancelled")
      return
    }
    await finishSignIn(redirectTo)
  }

  return (
    <Button variant="outline" className="h-9 w-full" disabled={pending} onClick={() => void signIn()}>
      {pending ? <Spinner /> : <FingerprintIcon />}
      Sign in with a passkey
    </Button>
  )
}
