//? "use client" // klin:only next
//? // klin:only next
import { Link } from "@tanstack/react-router" // klin:only vite
//? import Link from "next/link" // klin:only next
import { AuthDivider, AuthHeader } from "./auth-header" // klin:only oauth && (password || magic-link)
import { AuthHeader } from "./auth-header" // klin:only !(oauth && (password || magic-link))
import { MagicLinkForm } from "./magic-link-form" // klin:only magic-link && !password
import { SignUpForm } from "./sign-up-form" // klin:only password
import { SocialButtons } from "./social-buttons" // klin:only oauth

export function SignUpPage() {
  const redirectTo = "/dashboard"

  return (
    <div className="flex flex-col gap-6">
      <AuthHeader title="Create your account" description="Start building in less than a minute." />
      {/* klin:if oauth */}
      <SocialButtons callbackURL={redirectTo} />
      {/* klin:endif */}
      {/* klin:if oauth && (password || magic-link) */}
      <AuthDivider>or sign up with email</AuthDivider>
      {/* klin:endif */}
      {/* klin:if password */}
      <SignUpForm redirectTo={redirectTo} />
      {/* klin:elif magic-link */}
      <MagicLinkForm callbackURL={redirectTo} />
      {/* klin:endif */}
      <p className="text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline"> {/* klin:only vite */}
        {/*? <Link href="/sign-in" className="font-medium text-foreground underline-offset-4 hover:underline"> */} {/* klin:only next */}
          Sign in
        </Link>
      </p>
      <p className="text-center text-xs text-balance text-muted-foreground">
        By continuing you agree to our Terms of Service and Privacy Policy.
      </p>
    </div>
  )
}
