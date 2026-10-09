import { Link } from "@tanstack/react-router"
import { LanguageSwitcher } from "@/components/language-switcher" // klin:only i18n
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { useT } from "@/lib/i18n"
import { useSession } from "@/lib/session"

export function PublicHeader() {
  const { data: session } = useSession()
  const t = useT()

  return (
    <header className="sticky top-0 z-40 border-b border-transparent bg-background/70 backdrop-blur supports-backdrop-filter:bg-background/50">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="rounded-md">
          <Logo />
        </Link>
        <nav className="ml-6 hidden items-center gap-5 text-sm text-muted-foreground md:flex">
          <a href="#features" className="transition-colors hover:text-foreground">
            {t("landing.nav.features", "Features")}
          </a>
          <a href="#stack" className="transition-colors hover:text-foreground">
            {t("landing.nav.stack", "Stack")}
          </a>
        </nav>
        <div className="ml-auto flex items-center gap-1">
          <LanguageSwitcher /> {/* klin:only i18n */}
          <ThemeToggle />
          {session ? (
            <Button render={<Link to="/dashboard" />}>{t("landing.cta.dashboard", "Dashboard")}</Button>
          ) : (
            <>
              <Button variant="ghost" render={<Link to="/sign-in" />}>
                {t("landing.cta.signIn", "Sign in")}
              </Button>
              <Button render={<Link to="/sign-up" />}>{t("landing.cta.getStarted", "Get started")}</Button>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
