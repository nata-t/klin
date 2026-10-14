// klin:if next
//? import { usePathname } from "next/navigation"
// klin:else
import { useMatches } from "@tanstack/react-router"
import { useEffect } from "react"
// klin:endif
import { LanguageSwitcher } from "@/components/language-switcher" // klin:only i18n
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
// klin:if next
//? import {
//?   adminNav, // klin:only admin
//?   mainNav,
//?   secondaryNav,
//? } from "@/config/nav"
//?
//? const NAV = [
//?   ...mainNav,
//?   ...adminNav, // klin:only admin
//?   ...secondaryNav,
//? ]
// klin:else
import { siteConfig } from "@/config/site"
// klin:endif

// klin:if next
//? /** Top bar of the app shell. The title is the sidebar entry you're in (the tab's title comes from each page's metadata). */
//? export function AppHeader() {
//?   const pathname = usePathname()
//?   const title = NAV.find((item) => pathname === item.to || pathname.startsWith(`${item.to}/`))?.title
// klin:else
/** Top bar of the app shell. The title comes from the deepest route's `staticData.title`. */
export function AppHeader() {
  const title = useMatches({
    select: (matches) => [...matches].reverse().find((m) => m.staticData?.title)?.staticData.title,
  })

  useEffect(() => {
    document.title = title ? `${title} · ${siteConfig.name}` : siteConfig.name
  }, [title])
// klin:endif

  return (
    <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h2 className="truncate text-sm font-medium">{title}</h2>
      <div className="ml-auto flex items-center gap-1">
        <LanguageSwitcher /> {/* klin:only i18n */}
        <ThemeToggle />
      </div>
    </header>
  )
}
