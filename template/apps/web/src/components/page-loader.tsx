import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"

/** Shown while a route's loader runs (router default) or for any full-area wait. */
export function PageLoader({ label = "Loading…", className }: { label?: string; className?: string }) {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn("flex min-h-48 w-full flex-1 flex-col items-center justify-center gap-3 text-muted-foreground", className)}
    >
      <Spinner className="size-6 text-brand" />
      <p className="text-sm">{label}</p>
    </div>
  )
}
