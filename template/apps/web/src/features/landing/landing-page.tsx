import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  BoxesIcon,
  DatabaseIcon,
  FileCheck2Icon,
  KeyRoundIcon,
  PaletteIcon,
  RocketIcon,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useT } from "@/lib/i18n"
import { useSession } from "@/lib/session"
import { TerminalHero } from "./terminal-hero"

const FEATURES = [
  {
    icon: KeyRoundIcon,
    title: "Authentication that's done",
    body: "Sign up, sign in, reset, verify, sessions and guards — on the API and in the router.",
  },
  {
    icon: FileCheck2Icon,
    title: "One schema, both sides",
    body: "A Zod schema validates the form, the request and the response. Change it once.",
  },
  {
    icon: DatabaseIcon,
    title: "Typed data layer",
    // klin:if nest
    body: "Prisma models, a Nest service, and a TanStack Query hook — generated as one slice.",
    // klin:else
    //? body: "Prisma models, a typed route, and a TanStack Query hook — generated as one slice.",
    // klin:endif
  },
  {
    icon: PaletteIcon,
    title: "A UI you'd keep",
    body: "shadcn/ui components, dark mode, layouts, empty and error states out of the box.",
  },
  {
    icon: BoxesIcon,
    title: "Monorepo that scales",
    body: "Turborepo caching, shared configs, and packages for auth, db and validators.",
  },
  {
    icon: RocketIcon,
    title: "Ready to ship",
    body: "Docker images, CI, security headers, rate limiting, structured logs and health checks.",
  },
]

const STACK = [
  // klin:if nest-express
  "NestJS",
  "Express",
  // klin:elif nest-fastify
  //? "NestJS",
  //? "Fastify",
  // klin:elif express
  //? "Express",
  // klin:else
  //? "Fastify",
  // klin:endif
  "Better Auth",
  "Prisma",
  "TanStack Router",
  "TanStack Query",
  "TanStack Form",
  "Zod",
  "Tailwind CSS",
  "shadcn/ui",
  "Turborepo",
]

export function LandingPage() {
  const { data: session } = useSession()
  const t = useT()

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="bg-glow pointer-events-none absolute inset-0" />
        <div className="relative mx-auto max-w-4xl px-4 pt-16 pb-20 text-center sm:px-6 sm:pt-24">
          <TerminalHero />
          <h1 className="mt-12 text-4xl font-semibold tracking-tight text-balance sm:text-6xl">
            {t("landing.title", "Ship the product, not the plumbing.")}
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-balance text-muted-foreground">
            {t(
              "landing.subtitle",
              "A full-stack TypeScript foundation with authentication, a typed API, shared validation and a polished UI. Start where most projects end up after their first month."
            )}
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {session ? (
              <Button size="lg" className="h-11 px-5" render={<Link to="/dashboard" />}>
                {t("landing.cta.dashboard", "Dashboard")} <ArrowRightIcon />
              </Button>
            ) : (
              <Button size="lg" className="h-11 px-5" render={<Link to="/sign-up" />}>
                {t("landing.cta.getStarted", "Get started")} <ArrowRightIcon />
              </Button>
            )}
            <Button size="lg" variant="outline" className="h-11 px-5" render={<a href="#features" />}>
              {t("landing.cta.docs", "See what's inside")}
            </Button>
          </div>
        </div>
      </section>

      <section id="features" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-20 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <Card key={feature.title} className="bg-card/60">
              <CardHeader>
                <div className="mb-2 grid size-9 place-items-center rounded-lg bg-brand/10 text-brand">
                  <feature.icon className="size-5" />
                </div>
                <CardTitle>{feature.title}</CardTitle>
                <CardDescription>{feature.body}</CardDescription>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>

      <section id="stack" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-24 sm:px-6">
        <Card>
          <CardContent className="flex flex-col items-center gap-6 py-10 text-center">
            <h2 className="text-2xl font-semibold tracking-tight">Built on tools you already like</h2>
            <div className="flex flex-wrap justify-center gap-2">
              {STACK.map((item) => (
                <span key={item} className="rounded-full border bg-muted/50 px-3 py-1 text-sm">
                  {item}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </>
  )
}
