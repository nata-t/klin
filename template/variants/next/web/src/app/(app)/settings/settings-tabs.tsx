"use client"

import type { Route } from "next"
import Link from "next/link"
import { usePathname } from "next/navigation"

const TABS: Array<{ href: Route; label: string }> = [
  { href: "/settings", label: "Profile" },
  { href: "/settings/security", label: "Security" },
  { href: "/settings/api-keys", label: "API keys" }, // klin:only api-keys
  { href: "/settings/organization", label: "Organization" }, // klin:only organizations
]

export function SettingsTabs() {
  const pathname = usePathname()

  return (
    <nav className="-mb-2 flex gap-1 overflow-x-auto border-b">
      {TABS.map((tab) => {
        const active = pathname === tab.href
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            data-status={active ? "active" : undefined}
            className="-mb-px border-b-2 border-transparent px-3 py-2 text-sm whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground data-[status=active]:border-brand data-[status=active]:font-medium data-[status=active]:text-foreground"
          >
            {tab.label}
          </Link>
        )
      })}
    </nav>
  )
}
