import { Link } from "@tanstack/react-router" // klin:only vite
//? import Link from "next/link" // klin:only next
import { LogoMark } from "@/components/logo"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import {
  adminNav, // klin:only admin
  mainNav,
  secondaryNav,
} from "@/config/nav"
import { siteConfig } from "@/config/site"
import { OrganizationSwitcher } from "@/features/organizations/organization-switcher" // klin:only organizations
import { useCurrentUser } from "@/lib/session" // klin:only admin
import { NavMain } from "./nav-main"
import { UserMenu } from "./user-menu"

// The logo keeps its shape when the sidebar folds to icons: the name goes, and the egg grows to fill a
// slightly wider button that stays centered over the nav icons. Hovering it hatches the egg.
const LOGO_BUTTON =
  "group/hatch [&_svg]:h-7 [&_svg]:w-auto group-data-[collapsible=icon]:-mx-1 group-data-[collapsible=icon]:h-12! group-data-[collapsible=icon]:w-10! group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:[&_svg]:h-9"

export function AppSidebar() {
  const user = useCurrentUser() // klin:only admin

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" className={LOGO_BUTTON} render={<Link to="/dashboard" />}> {/* klin:only vite */}
            {/*? <SidebarMenuButton size="lg" className={LOGO_BUTTON} render={<Link href="/dashboard" />}> */} {/* klin:only next */}
              <LogoMark hatch="hover" />
              <span className="font-semibold tracking-tight group-data-[collapsible=icon]:hidden">{siteConfig.name}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <OrganizationSwitcher /> {/* klin:only organizations */}
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={mainNav} />
        {user.role === "admin" && <NavMain items={adminNav} label="Admin" />} {/* klin:only admin */}
        <NavMain items={secondaryNav} label="Account" />
      </SidebarContent>
      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
