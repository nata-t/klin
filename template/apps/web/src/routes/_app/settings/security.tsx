import { createFileRoute } from "@tanstack/react-router"
import { PasskeysCard } from "@/features/settings/passkeys-card" // klin:only passkey
import { PasswordCard } from "@/features/settings/password-card" // klin:only password
import { SessionsCard } from "@/features/settings/sessions-card"
import { TwoFactorCard } from "@/features/settings/two-factor-card" // klin:only two-factor

export const Route = createFileRoute("/_app/settings/security")({
  staticData: { title: "Security" },
  component: () => (
    <>
      <PasswordCard /> {/* klin:only password */}
      <TwoFactorCard /> {/* klin:only two-factor */}
      <PasskeysCard /> {/* klin:only passkey */}
      <SessionsCard />
    </>
  ),
})
