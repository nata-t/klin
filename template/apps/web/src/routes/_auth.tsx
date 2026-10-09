import { createFileRoute, Link, Outlet, redirect } from "@tanstack/react-router"
import { CheckIcon } from "lucide-react"
import { Logo } from "@/components/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { siteConfig } from "@/config/site"
import { sessionQueryOptions } from "@/lib/session"

/** Layout for sign-in/up and friends. Signed-in users are sent to the app. */
export const Route = createFileRoute("/_auth")({
  beforeLoad: async ({ context }) => {
    const session = await context.queryClient.ensureQueryData(sessionQueryOptions)
    if (session) throw redirect({ to: "/dashboard" })
  },
  component: AuthLayout,
})

const HIGHLIGHTS = [
  "Secure sessions with HTTP-only cookies",
  "One schema validates the form and the API",
  "Typed end to end, database to button",
]

function AuthLayout() {
  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-zinc-950 p-10 text-zinc-50 lg:flex lg:flex-col">
        <div className="bg-glow absolute inset-0 opacity-80" />
        <div className="absolute -right-24 -bottom-24 size-96 rounded-full bg-brand/30 blur-3xl" />
        <Link to="/" className="relative">
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
          <Link to="/" className="lg:hidden">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
