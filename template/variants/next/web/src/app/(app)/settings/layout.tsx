import type { ReactNode } from "react"
import { PageHeader } from "@/components/page-header"
import { SettingsTabs } from "./settings-tabs"

export default function SettingsLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <SettingsTabs />
      <div className="grid max-w-3xl gap-6">{children}</div>
    </>
  )
}
