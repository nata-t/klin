import { useNavigate } from "@tanstack/react-router" // klin:only vite
//? import { useRouter } from "next/navigation" // klin:only next
import {
  ChevronsUpDownIcon,
  DownloadIcon, // klin:only pwa
  LogOutIcon,
  RefreshCwIcon, // klin:only pwa
  SettingsIcon,
  ShieldCheckIcon,
} from "lucide-react"
import { useState } from "react" // klin:only pwa
import { Badge } from "@/components/ui/badge" // klin:only pwa
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar"
import { usePWAInstall, usePWAUpdate } from "@/hooks/use-pwa" // klin:only pwa
import { useT } from "@/lib/i18n"
import { signOut, useCurrentUser } from "@/lib/session"
import { cn } from "@/lib/utils" // klin:only pwa
import { UserAvatar } from "./user-avatar"

export function UserMenu() {
  const user = useCurrentUser()
  const navigate = useNavigate() // klin:only vite
  //? const router = useRouter() // klin:only next
  const { isMobile } = useSidebar()
  const t = useT()
  // klin:if pwa
  const { needsUpdate, reloadToLatest } = usePWAUpdate()
  const { canInstall, promptInstall } = usePWAInstall()
  const [reloading, setReloading] = useState(false)
  // klin:endif

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <SidebarMenuButton
                size="lg"
                className="data-popup-open:bg-sidebar-accent data-popup-open:text-sidebar-accent-foreground"
              />
            }
          >
            {/* klin:if pwa */}
            <span className="relative shrink-0">
              <UserAvatar name={user.name} image={user.image} />
              {needsUpdate && (
                <span className="absolute top-0 right-0 size-2 rounded-full bg-brand ring-2 ring-sidebar">
                  <span className="sr-only">{t("menu.updateReady", "Update ready")}</span>
                </span>
              )}
            </span>
            {/* klin:else */}
            {/*? <UserAvatar name={user.name} image={user.image} /> */}
            {/* klin:endif */}
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-medium">{user.name}</span>
              <span className="truncate text-xs text-muted-foreground">{user.email}</span>
            </div>
            <ChevronsUpDownIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--anchor-width) min-w-56"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserAvatar name={user.name} image={user.image} />
                  <div className="grid flex-1 leading-tight">
                    <span className="truncate font-medium text-foreground">{user.name}</span>
                    <span className="truncate text-xs">{user.email}</span>
                  </div>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings" })}> {/* klin:only vite */}
              {/*? <DropdownMenuItem onClick={() => router.push("/settings")}> */} {/* klin:only next */}
                <SettingsIcon /> {t("menu.settings", "Settings")}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => navigate({ to: "/settings/security" })}> {/* klin:only vite */}
              {/*? <DropdownMenuItem onClick={() => router.push("/settings/security")}> */} {/* klin:only next */}
                <ShieldCheckIcon /> {t("menu.security", "Security")}
              </DropdownMenuItem>
            </DropdownMenuGroup>
            {/* klin:if pwa */}
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem
                closeOnClick={false}
                disabled={reloading}
                onClick={() => {
                  setReloading(true)
                  void reloadToLatest()
                }}
              >
                <RefreshCwIcon className={cn(reloading && "animate-spin")} />
                <span className="flex-1">
                  {reloading ? t("menu.updating", "Updating…") : t("menu.reload", "Reload latest version")}
                </span>
                {needsUpdate && !reloading && <Badge>{t("menu.new", "New")}</Badge>}
              </DropdownMenuItem>
              {canInstall && (
                <DropdownMenuItem onClick={() => void promptInstall()}>
                  <DownloadIcon /> {t("menu.install", "Install app")}
                </DropdownMenuItem>
              )}
            </DropdownMenuGroup>
            {/* klin:endif */}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => void signOut()}>
              <LogOutIcon /> {t("menu.signOut", "Sign out")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
