import { useNavigate } from "@tanstack/react-router" // klin:only vite
//? import { useRouter } from "next/navigation" // klin:only next
import { VenetianMaskIcon } from "lucide-react"
import { Button } from "@/components/ui/button"
import { authClient } from "@/lib/auth-client"
import { refreshSession, useCurrentSession } from "@/lib/session"

export function ImpersonationBanner() {
  const { session, user } = useCurrentSession()
  const navigate = useNavigate() // klin:only vite
  //? const router = useRouter() // klin:only next
  if (!session.impersonatedBy) return null

  async function stop() {
    await authClient.admin.stopImpersonating()
    await refreshSession()
    await navigate({ to: "/admin" }) // klin:only vite
    //? router.push("/admin") // klin:only next
  }

  return (
    <div className="flex items-center gap-3 border-b bg-brand px-4 py-2 text-sm text-brand-foreground">
      <VenetianMaskIcon className="size-4" />
      <p className="flex-1">
        You're viewing the app as <strong>{user.name}</strong>.
      </p>
      <Button size="sm" variant="secondary" onClick={() => void stop()}>
        Stop impersonating
      </Button>
    </div>
  )
}
