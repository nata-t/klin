// klin:file oauth
import { useState } from "react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"

type Provider =
  | "google" // klin:only google
  | "github" // klin:only github

const PROVIDERS: Array<{ id: Provider; label: string; icon: () => React.ReactNode }> = [
  { id: "google", label: "Google", icon: GoogleIcon }, // klin:only google
  { id: "github", label: "GitHub", icon: GitHubIcon }, // klin:only github
]

/** OAuth buttons. Providers switch on once their client id/secret are in .env. */
export function SocialButtons({ callbackURL }: { callbackURL: string }) {
  const [pending, setPending] = useState<Provider | null>(null)

  async function signIn(provider: Provider) {
    setPending(provider)
    const { error } = await authClient.signIn.social({
      provider,
      callbackURL,
      errorCallbackURL: "/sign-in",
    })
    if (error) {
      toast.error(error.message ?? `Couldn't start ${provider} sign-in. Is it configured in .env?`)
      setPending(null)
    }
  }

  return (
    <div className="grid gap-2">
      {PROVIDERS.map(({ id, label, icon: Icon }) => (
        <Button key={id} variant="outline" className="h-9" disabled={pending !== null} onClick={() => void signIn(id)}>
          {pending === id ? <Spinner /> : <Icon />}
          Continue with {label}
        </Button>
      ))}
    </div>
  )
}
// klin:if google

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.13-1.43.34-2.09V7.07H2.18A11 11 0 0 0 1 12c0 1.78.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
// klin:endif
// klin:if github

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.1.79-.25.79-.56v-2c-3.2.7-3.88-1.37-3.88-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.69 0-1.26.45-2.29 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.83 1.19 3.09 0 4.42-2.7 5.39-5.26 5.68.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 12 .5z" />
    </svg>
  )
}
// klin:endif
