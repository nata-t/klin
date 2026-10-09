import { createRouter } from "@tanstack/react-router"
import { NotFound } from "@/components/not-found"
import { PageLoader } from "@/components/page-loader"
import { RouteError } from "@/components/route-error"
import { queryClient } from "@/lib/query-client"
import { routeTree } from "./routeTree.gen"

export const router = createRouter({
  routeTree,
  context: { queryClient },
  // Preload route code + data when a link is hovered.
  defaultPreload: "intent",
  // React Query owns caching; the router always asks it.
  defaultPreloadStaleTime: 0,
  scrollRestoration: true,
  defaultErrorComponent: RouteError,
  defaultNotFoundComponent: NotFound,
  defaultPendingComponent: () => <PageLoader />,
  defaultPendingMs: 250,
  defaultPendingMinMs: 300,
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
  interface StaticDataRouteOption {
    /** Shown in the app header and the browser tab. */
    title?: string
  }
}
