import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { type Hatch, KlinMark } from "./klin-mark"

/** The mark on its own, in the color of the text around it (so it works on light and dark). Swap it for your own. */
export function LogoMark({ className, hatch }: { className?: string; hatch?: Hatch }) {
  return <KlinMark hatch={hatch} className={cn("h-6 w-auto shrink-0", className)} />
}

/** Your app's logo: the mark and the app's name. The egg hatches while the logo is hovered. Make it yours. */
export function Logo({ className, showName = true, hatch = "hover" }: { className?: string; showName?: boolean; hatch?: Hatch }) {
  return (
    <span className={cn("group/hatch inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark hatch={hatch} />
      {showName && <span className="truncate">{siteConfig.name}</span>}
    </span>
  )
}
