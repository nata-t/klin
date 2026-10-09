import { createFileRoute } from "@tanstack/react-router"
import { DeleteAccountCard } from "@/features/settings/delete-account-card"
import { ProfileCard } from "@/features/settings/profile-card"

export const Route = createFileRoute("/_app/settings/")({
  staticData: { title: "Profile" },
  component: () => (
    <>
      <ProfileCard />
      <DeleteAccountCard />
    </>
  ),
})
