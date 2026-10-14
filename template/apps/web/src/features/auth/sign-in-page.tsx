//? "use client" // klin:only next
//? // klin:only next
// klin:if next
//? import Link from "next/link"
//? import { useSearchParams } from "next/navigation"
// klin:else
import { getRouteApi, Link } from "@tanstack/react-router"
// klin:endif
import { useState } from "react" // klin:only password && magic-link
import { Button } from "@/components/ui/button" // klin:only password && magic-link
import { safeRedirect } from "@/lib/session"
import { AuthDivider, AuthHeader } from "./auth-header" // klin:only oauth && (password || magic-link)
import { AuthHeader } from "./auth-header" // klin:only !(oauth && (password || magic-link))
import { MagicLinkForm } from "./magic-link-form" // klin:only magic-link
import { PasskeySignInButton } from "./passkey-sign-in-button" // klin:only passkey
import { SignInForm } from "./sign-in-form" // klin:only password
import { SocialButtons } from "./social-buttons" // klin:only oauth

const route = getRouteApi("/_auth/sign-in") // klin:only vite

export function SignInPage() {
  // klin:if next
  //? const searchParams = useSearchParams()
  //? const redirectTo = safeRedirect(searchParams.get("redirect"))
  // klin:else
  const search = route.useSearch()
  const redirectTo = safeRedirect(search.redirect)
  // klin:endif
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
        <Link to="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline"> {/* klin:only vite */}
        {/*? <Link href="/sign-up" className="font-medium text-foreground underline-offset-4 hover:underline"> */} {/* klin:only next */}
          Create an account
        </Link>
      </p>
    </div>
  )
}
