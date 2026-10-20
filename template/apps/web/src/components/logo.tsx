import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { KlinMark } from "./klin-mark"

/** Your app's logo: the klin mark on your brand color, and the app's name. Make it yours. */
export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm">
        <KlinMark className="h-4 w-auto" />
      </span>
      {showName && <span>{siteConfig.name}</span>}
    </span>
  )
}
