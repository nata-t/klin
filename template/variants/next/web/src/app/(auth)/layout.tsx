import { CheckIcon } from "lucide-react"
import Link from "next/link"
import { redirect } from "next/navigation"
import type { ReactNode } from "react"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { siteConfig } from "@/config/site"
import { getServerSession } from "@/lib/server-session"

const HIGHLIGHTS = [
  "Secure sessions with HTTP-only cookies",
  "One schema validates the form and the API",
  "Typed end to end, database to button",
]

/** Layout for sign-in/up and friends. Signed-in users are sent to the app. */
export default async function AuthLayout({ children }: { children: ReactNode }) {
  if (await getServerSession()) redirect("/dashboard")

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex lg:flex-col">
        <div className="bg-glow absolute inset-0 opacity-80" />
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-brand/30 blur-3xl" />
        <Link href="/" className="relative">
          <Logo />
        </Link>
        <div className="relative mt-auto space-y-6">
          <p className="max-w-md text-3xl leading-tight font-semibold tracking-tight">
            {siteConfig.description}
          </p>
          <ul className="space-y-2 text-sm text-zinc-300">
            {HIGHLIGHTS.map((item) => (
              <li key={item} className="flex items-center gap-2">
                <CheckIcon className="size-4 text-brand" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </aside>
      <div className="flex flex-col p-6 md:p-10">
        <div className="flex items-center justify-between lg:justify-end">
          <Link href="/" className="lg:hidden">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
      </div>
    </div>
  )
}
