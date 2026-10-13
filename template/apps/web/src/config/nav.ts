import type { LinkProps } from "@tanstack/react-router"
import {
  LayoutDashboardIcon,
  type LucideIcon,
  SettingsIcon,
  ShieldIcon, // klin:only admin
  StickyNoteIcon,
  // klin-anchor:nav-icons
} from "lucide-react"

export interface NavItem {
  /** Also the i18n key: `nav.<id>`. */
  id: string
  title: string
  to: LinkProps["to"]
  icon: LucideIcon
}

/** Sidebar navigation. `klin generate` adds entries at the anchor. */
export const mainNav: NavItem[] = [
  { id: "dashboard", title: "Dashboard", to: "/dashboard", icon: LayoutDashboardIcon },
  { id: "notes", title: "Notes", to: "/notes", icon: StickyNoteIcon },
  // klin-anchor:nav
]

export const secondaryNav: NavItem[] = [
  { id: "settings", title: "Settings", to: "/settings", icon: SettingsIcon },
]
// klin:if admin

export const adminNav: NavItem[] = [
  { id: "admin", title: "Admin", to: "/admin", icon: ShieldIcon },
]
// klin:endif
