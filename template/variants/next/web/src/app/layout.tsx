import type { Metadata, Viewport } from "next" // klin:only pwa
//? import type { Metadata } from "next" // klin:only !pwa
import type { ReactNode } from "react"
import { siteConfig } from "@/config/site"
import { getLanguage } from "@/i18n/server" // klin:only i18n
import { Providers } from "./providers"
import "@/styles.css" // klin:only apps-web
//? import "@repo/ui/globals.css" // klin:only packages-ui

export const metadata: Metadata = {
  title: { default: siteConfig.name, template: `%s · ${siteConfig.name}` },
  description: siteConfig.description,
  // klin:if pwa
  icons: { icon: "/favicon.svg", apple: "/apple-touch-icon.png" },
  appleWebApp: { title: siteConfig.name },
  // klin:else
  //? icons: { icon: "/favicon.svg" },
  // klin:endif
}
// klin:if pwa

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}
// klin:endif

// Applies the saved theme before first paint (no flash of the wrong theme).
const themeScript = `try {
  const t = localStorage.getItem("theme") || "system"
  const dark = t === "dark" || (t === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  document.documentElement.classList.add(dark ? "dark" : "light")
} catch {}`

// klin:if i18n
export default async function RootLayout({ children }: { children: ReactNode }) {
  const language = await getLanguage()
  return (
    <html lang={language} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <Providers language={language}>{children}</Providers>
      </body>
    </html>
  )
}
// klin:else
//? export default function RootLayout({ children }: { children: ReactNode }) {
//?   return (
//?     <html lang="en" suppressHydrationWarning>
//?       <head>
//?         <script dangerouslySetInnerHTML={{ __html: themeScript }} />
//?       </head>
//?       <body>
//?         <Providers>{children}</Providers>
//?       </body>
//?     </html>
//?   )
//? }
// klin:endif
