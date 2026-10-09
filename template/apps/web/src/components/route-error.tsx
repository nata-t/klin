import { type ErrorComponentProps, Link, useRouter } from "@tanstack/react-router"
import { useQueryErrorResetBoundary } from "@tanstack/react-query"
import { RotateCcwIcon, TriangleAlertIcon } from "lucide-react"
import { useEffect } from "react"
import { Button } from "@/components/ui/button"
import { isApiError } from "@/lib/api-error"

/**
 * Error boundary for every route (set as the router's defaultErrorComponent).
 * Catches render errors and failed loaders; "Try again" re-runs the loader.
 */
export function RouteError({ error, reset }: ErrorComponentProps) {
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
              reset()
              void router.invalidate()
            }}
          >
            <RotateCcwIcon /> Try again
          </Button>
          <Button variant="outline" render={<Link to="/" />}>
            Go home
          </Button>
        </div>
        {import.meta.env.DEV && error instanceof Error && error.stack && (
          <pre className="mt-6 max-h-64 overflow-auto rounded-lg bg-muted p-3 text-left text-xs text-muted-foreground">
            {error.stack}
          </pre>
        )}
      </div>
    </div>
  )
}
