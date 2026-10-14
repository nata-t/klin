import { Link } from "@tanstack/react-router" // klin:only vite
//? import Link from "next/link" // klin:only next
import { Logo } from "@/components/logo"
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
import { OrganizationSwitcher } from "@/features/organizations/organization-switcher" // klin:only organizations
import { useCurrentUser } from "@/lib/session" // klin:only admin
import { NavMain } from "./nav-main"
import { UserMenu } from "./user-menu"

export function AppSidebar() {
  const user = useCurrentUser() // klin:only admin

  return (
    <Sidebar collapsible="icon" variant="inset">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/dashboard" />}> {/* klin:only vite */}
            {/*? <SidebarMenuButton size="lg" render={<Link href="/dashboard" />}> */} {/* klin:only next */}
              <Logo />
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
