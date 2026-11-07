//? "use client" // klin:only next
//? // klin:only next
import { DownloadIcon, RefreshCwIcon, XIcon } from "lucide-react"
import { useEffect } from "react"
import { toast } from "sonner"
import { LogoMark } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { siteConfig } from "@/config/site"
import { usePWAInstall, usePWAUpdate } from "@/hooks/use-pwa"
import { useT } from "@/lib/i18n"
import { cn } from "@/lib/utils"

/** The installable app's two nudges: "a new version is ready" and "install the app". */
export function PWAPrompts() {
  return (
    <>
      <UpdateToast />
      <InstallBanner />
    </>
  )
}

/** The egg hatching on the brand color: something new is here. */
function HatchTile({ className }: { className?: string }) {
  return (
    <span className={cn("grid shrink-0 place-items-center rounded-lg bg-brand text-brand-foreground", className)}>
      <LogoMark hatch="loop" className="h-1/2" />
    </span>
  )
}

/** Once a new version is installed and waiting, a toast offers to reload into it. It stays until it's answered. */
function UpdateToast() {
  const { needsUpdate, reloadToLatest } = usePWAUpdate()
  const t = useT()
  const title = t("pwa.update.title", "A new version is ready")
  const body = t("pwa.update.body", "Reload to get the latest fixes and features.")
  const reload = t("pwa.update.reload", "Reload")
  const later = t("pwa.update.later", "Later")

  useEffect(() => {
    if (!needsUpdate) return
    toast.custom(
      (id) => (
        <div className="flex w-full items-start gap-3 rounded-xl border bg-popover p-4 text-popover-foreground shadow-lg sm:w-(--width)">
          <HatchTile className="size-9" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium">{title}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">{body}</p>
            <div className="mt-3 flex gap-2">
              <Button
                size="sm"
                onClick={() => {
                  toast.dismiss(id)
                  void reloadToLatest()
                }}
              >
                <RefreshCwIcon /> {reload}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => toast.dismiss(id)}>
                {later}
              </Button>
            </div>
          </div>
        </div>
      ),
      // One id, so a re-render replaces the toast instead of stacking another.
      { id: "pwa-update", duration: Infinity }
    )
  }, [needsUpdate, reloadToLatest, title, body, reload, later])

  return null
}

/** When the browser says the app can be installed, a banner offers it. Dismissed, it stays away until the next visit. */
function InstallBanner() {
  const { canInstall, promptInstall, isDismissed, dismiss } = usePWAInstall()
  const t = useT()
  if (!canInstall || isDismissed) return null

  return (
    <div
      role="complementary"
      aria-label={t("pwa.install.label", "Install the app")}
      className="fixed inset-x-4 bottom-4 z-50 mx-auto flex max-w-md animate-in items-center gap-3 rounded-xl border bg-popover/95 p-3 pr-2 text-popover-foreground shadow-lg backdrop-blur duration-300 fade-in slide-in-from-bottom-4 sm:bottom-6"
    >
      <HatchTile className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">
          {t("pwa.install.title", "Install {{name}}", { name: siteConfig.name })}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("pwa.install.body", "Open it from your home screen or dock, like any app.")}
        </p>
      </div>
      <Button size="sm" onClick={() => void promptInstall()}>
        <DownloadIcon /> {t("pwa.install.action", "Install")}
      </Button>
      <Button size="icon-sm" variant="ghost" aria-label={t("pwa.install.dismiss", "Not now")} onClick={dismiss}>
        <XIcon />
      </Button>
    </div>
  )
}
