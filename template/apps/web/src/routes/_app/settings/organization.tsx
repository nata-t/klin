import { createFileRoute } from "@tanstack/react-router"
import { OrganizationSettings } from "@/features/organizations/organization-settings"

export const Route = createFileRoute("/_app/settings/organization")({
  staticData: { title: "Organization" },
  component: OrganizationSettings,
})
