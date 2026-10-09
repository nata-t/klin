import { useMatches } from "@tanstack/react-router"
import { useEffect } from "react"
import { LanguageSwitcher } from "@/components/language-switcher" // klin:only i18n
import { ThemeToggle } from "@/components/theme-toggle"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { siteConfig } from "@/config/site"

/** Top bar of the app shell. The title comes from the deepest route's `staticData.title`. */
export function AppHeader() {
  const title = useMatches({
    select: (matches) => [...matches].reverse().find((m) => m.staticData?.title)?.staticData.title,
  })

  useEffect(() => {
    document.title = title ? `${title} · ${siteConfig.name}` : siteConfig.name
  }, [title])

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
