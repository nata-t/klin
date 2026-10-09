import { SparklesIcon } from "lucide-react"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"

export function Logo({ className, showName = true }: { className?: string; showName?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <span className="grid size-7 place-items-center rounded-lg bg-brand text-brand-foreground shadow-sm">
        <SparklesIcon className="size-4" />
      </span>
      {showName && <span>{siteConfig.name}</span>}
    </span>
  )
}
