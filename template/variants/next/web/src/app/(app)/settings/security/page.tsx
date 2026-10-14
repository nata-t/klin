import type { Metadata } from "next"
import { PasskeysCard } from "@/features/settings/passkeys-card" // klin:only passkey
import { PasswordCard } from "@/features/settings/password-card" // klin:only password
import { SessionsCard } from "@/features/settings/sessions-card"
import { TwoFactorCard } from "@/features/settings/two-factor-card" // klin:only two-factor

export const metadata: Metadata = { title: "Security" }

export default function Page() {
  return (
    <>
      <PasswordCard /> {/* klin:only password */}
      <TwoFactorCard /> {/* klin:only two-factor */}
      <PasskeysCard /> {/* klin:only passkey */}
      <SessionsCard />
    </>
  )
}
