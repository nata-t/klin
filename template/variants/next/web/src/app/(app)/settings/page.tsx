import type { Metadata } from "next"
import { DeleteAccountCard } from "@/features/settings/delete-account-card"
import { ProfileCard } from "@/features/settings/profile-card"

export const metadata: Metadata = { title: "Profile" }

export default function Page() {
  return (
    <>
      <ProfileCard />
      <DeleteAccountCard />
    </>
  )
}
