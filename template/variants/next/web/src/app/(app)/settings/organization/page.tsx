// klin:file organizations
import type { Metadata } from "next"
import { OrganizationSettings } from "@/features/organizations/organization-settings"

export const metadata: Metadata = { title: "Organization" }

export default function Page() {
  return <OrganizationSettings />
}
