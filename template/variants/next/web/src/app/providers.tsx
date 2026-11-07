"use client"

import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { type ReactNode, useState } from "react" // klin:only i18n
//? import type { ReactNode } from "react" // klin:only !i18n
import { I18nextProvider } from "react-i18next" // klin:only i18n
import { PWAPrompts } from "@/components/pwa-prompts" // klin:only pwa
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import type { Language } from "@/i18n" // klin:only i18n
import { createI18n } from "@/i18n/client" // klin:only i18n
import { initPWA } from "@/lib/pwa" // klin:only pwa
import { getQueryClient } from "@/lib/query-client"
// klin:if pwa

// Catches the install prompt and registers the service worker as soon as the page loads (a no-op on the server).
initPWA()
// klin:endif

/** Everything the pages run inside, in the browser: data, theme, tooltips, toasts. */
// klin:if i18n
export function Providers({ children, language }: { children: ReactNode; language: Language }) {
  const queryClient = getQueryClient()
  const [i18n] = useState(() => createI18n(language))
// klin:else
//? export function Providers({ children }: { children: ReactNode }) {
//?   const queryClient = getQueryClient()
// klin:endif

  const app = (
    <ThemeProvider>
      <TooltipProvider>
        {children}
        <Toaster richColors closeButton position="top-right" />
        <PWAPrompts /> {/* klin:only pwa */}
        <ReactQueryDevtools buttonPosition="bottom-left" />
      </TooltipProvider>
    </ThemeProvider>
  )

  return (
    <QueryClientProvider client={queryClient}>
      <I18nextProvider i18n={i18n}>{app}</I18nextProvider> {/* klin:only i18n */}
      {/*? {app} */} {/* klin:only !i18n */}
    </QueryClientProvider>
  )
}
