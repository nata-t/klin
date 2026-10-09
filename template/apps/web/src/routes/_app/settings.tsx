import { createFileRoute, Link, Outlet } from "@tanstack/react-router"
import { PageHeader } from "@/components/page-header"

const TABS = [
  { to: "/settings", label: "Profile" },
  { to: "/settings/security", label: "Security" },
  { to: "/settings/api-keys", label: "API keys" }, // klin:only api-keys
  { to: "/settings/organization", label: "Organization" }, // klin:only organizations
] as const

export const Route = createFileRoute("/_app/settings")({
  staticData: { title: "Settings" },
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <>
      <PageHeader title="Settings" description="Manage your account and preferences." />
      <nav className="-mb-2 flex gap-1 overflow-x-auto border-b">
        {TABS.map((tab) => (
          <Link
            key={tab.to}
            to={tab.to}
            activeOptions={{ exact: true }}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-brand data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            {tab.label}
          </Link>
        ))}
      </nav>
      <div className="grid max-w-3xl gap-6">
        <Outlet />
      </div>
    </>
  )
}
