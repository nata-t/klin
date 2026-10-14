// klin:if next
//? import Link from "next/link"
//? import { useRouter } from "next/navigation"
// klin:else
import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router"
// klin:endif
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect } from "react" // klin:only vite
//? import { startTransition, useEffect } from "react" // klin:only next
import { Button } from "@/components/ui/button"
import { isApiError } from "@/lib/api-error"

// klin:if next
//? /**
//?  * The error screen for app/error.tsx: a page that crashed while rendering.
//?  * "Try again" fetches its server parts again and renders it once more.
//?  */
// klin:else
/**
 * Error boundary for every route (set as the router's defaultErrorComponent).
 * Catches render errors and failed loaders; "Try again" re-runs the loader.
 */
// klin:endif
export function RouteError({ error, reset }: ErrorComponentProps) { // klin:only vite
//? export function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { // klin:only next
  const router = useRouter()
  const queryReset = useQueryErrorResetBoundary()

  useEffect(() => {
    queryReset.reset()
  }, [queryReset])

  const message = error instanceof Error ? error.message : "An unexpected error occurred."
  const requestId = isApiError(error) ? error.requestId : undefined

  return (
    <div className="flex min-h-[60vh] flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md text-center">
        <div className="mx-auto mb-5 grid size-12 place-items-center rounded-full bg-destructive/10 text-destructive">
          <TriangleAlertIcon className="size-6" />
        </div>
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        {requestId && (
          <p className="mt-2 font-mono text-xs text-muted-foreground">Request ID: {requestId}</p>
        )}
        <div className="mt-6 flex justify-center gap-2">
          <Button
            onClick={() => {
              // klin:if next
              //? // Fetch the page's server parts again, then render it.
              //? startTransition(() => {
              //?   router.refresh()
              //?   reset()
              //? })
              // klin:else
              reset()
              void router.invalidate()
              // klin:endif
            }}
          >
            <RotateCcwIcon /> Try again
          </Button>
          <Button variant="outline" render={<Link to="/" />}> {/* klin:only vite */}
          {/*? <Button variant="outline" render={<Link href="/" />}> */} {/* klin:only next */}
            Go home
          </Button>
        </div>
        {import.meta.env.DEV && error instanceof Error && error.stack && ( // klin:only vite
        //? {process.env.NODE_ENV === "development" && error instanceof Error && error.stack && ( // klin:only next
          <pre className="mt-6 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  )
}
