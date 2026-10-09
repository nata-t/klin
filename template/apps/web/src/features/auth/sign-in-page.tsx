import { getRouteApi, Link } from "@tanstack/react-router"
import { useState } from "react" // klin:only password && magic-link
import { Button } from "@/components/ui/button" // klin:only password && magic-link
import { safeRedirect } from "@/lib/session"
import { AuthDivider, AuthHeader } from "./auth-header" // klin:only oauth && (password || magic-link)
import { AuthHeader } from "./auth-header" // klin:only !(oauth && (password || magic-link))
import { MagicLinkForm } from "./magic-link-form" // klin:only magic-link
import { PasskeySignInButton } from "./passkey-sign-in-button" // klin:only passkey
import { SignInForm } from "./sign-in-form" // klin:only password
import { SocialButtons } from "./social-buttons" // klin:only oauth

const route = getRouteApi("/_auth/sign-in")

export function SignInPage() {
  const search = route.useSearch()
  const redirectTo = safeRedirect(search.redirect)
  const [useMagicLink, setUseMagicLink] = useState(false) // klin:only password && magic-link

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title="Welcome back" description="Sign in to your account to continue." />
      {/* klin:if oauth */}
      <SocialButtons callbackURL={redirectTo} />
      {/* klin:endif */}
      {/* klin:if oauth && (password || magic-link) */}
      <AuthDivider>or continue with email</AuthDivider>
      {/* klin:endif */}
      {/* klin:if password && magic-link */}
      {useMagicLink ? <MagicLinkForm callbackURL={redirectTo} /> : <SignInForm redirectTo={redirectTo} />}
      <Button variant="link" size="sm" className="-mt-3 self-center" onClick={() => setUseMagicLink((v) => !v)}>
        {useMagicLink ? "Use a password instead" : "Email me a sign-in link instead"}
      </Button>
      {/* klin:elif password */}
      <SignInForm redirectTo={redirectTo} />
      {/* klin:elif magic-link */}
      <MagicLinkForm callbackURL={redirectTo} />
      {/* klin:endif */}
      <PasskeySignInButton redirectTo={redirectTo} /> {/* klin:only passkey */}
      <p className="text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
