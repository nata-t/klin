// klin:if next
//? import Link from "next/link"
//? import { usePathname } from "next/navigation"
// klin:else
import { Link, useRouterState } from "@tanstack/react-router"
// klin:endif
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar"
import type { NavItem } from "@/config/nav"
import { useT } from "@/lib/i18n"

export function NavMain({ items, label }: { items: NavItem[]; label?: string }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname }) // klin:only vite
  //? const pathname = usePathname() // klin:only next
  const { isMobile, setOpenMobile } = useSidebar()
  const t = useT()

  return (
    <SidebarGroup>
      {label && <SidebarGroupLabel>{label}</SidebarGroupLabel>}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const active = pathname === item.to || pathname.startsWith(`${item.to}/`)
            const title = t(`nav.${item.id}`, item.title)
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  isActive={active}
                  tooltip={title}
                  render={<Link to={item.to} onClick={() => isMobile && setOpenMobile(false)} />} // klin:only vite
                  //? render={<Link href={item.to} onClick={() => isMobile && setOpenMobile(false)} />} // klin:only next
                >
                  <item.icon />
                  <span>{title}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            )
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  )
}
