import { QueryClientProvider } from "@tanstack/react-query"
import { RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import "./styles.css" // klin:only apps-web
//? import "@repo/ui/globals.css" // klin:only packages-ui
import "./i18n" // klin:only i18n
import { queryClient } from "@/lib/query-client"
import { router } from "./router"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>
)
