import { Link } from "@tanstack/react-router"
import {
  ArrowRightIcon,
  CheckCircle2Icon,
  CircleIcon,
  MailCheckIcon, // klin:only password
  PinIcon,
  ShieldCheckIcon, // klin:only two-factor
  StickyNoteIcon,
  TerminalIcon,
} from "lucide-react"
import type { ReactNode } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useNotes } from "@/features/notes/api"
import { useT } from "@/lib/i18n"
import { useCurrentUser } from "@/lib/session"

export function DashboardPage() {
  const user = useCurrentUser()
  const t = useT()
  const notes = useNotes({ limit: 1 })
  const pinned = useNotes({ limit: 1, pinned: true })
  const firstName = user.name.split(" ")[0] ?? user.name

  const checklist: Array<{ done: boolean; label: ReactNode; action?: ReactNode }> = [
    {
      done: (notes.data?.pagination.total ?? 0) > 0,
      label: "Create your first note",
      action: <Link to="/notes" className="text-brand hover:underline">Open notes</Link>,
    },
    // klin:if password
    {
      done: user.emailVerified,
      label: "Verify your email address",
    },
    // klin:endif
    // klin:if two-factor
    {
      done: Boolean(user.twoFactorEnabled),
      label: "Turn on two-factor authentication",
      action: <Link to="/settings/security" className="text-brand hover:underline">Security settings</Link>,
    },
    // klin:endif
    {
      done: false,
      label: (
        <>
          Generate your own resource with <code className="rounded bg-muted px-1 py-0.5 text-xs">pnpm klin generate resource</code>
        </>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title={t("dashboard.greeting", "Welcome back, {{name}}", { name: firstName })}
        description={t("dashboard.subtitle", "Here's what's happening in your workspace.")}
        actions={
          <Button render={<Link to="/notes" />}>
            <StickyNoteIcon /> Notes
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Notes" icon={<StickyNoteIcon />} value={notes.data?.pagination.total} />
        <StatCard label="Pinned" icon={<PinIcon />} value={pinned.data?.pagination.total} />
        <StatCard label="Email" icon={<MailCheckIcon />} value={user.emailVerified ? "Verified" : "Unverified"} /> {/* klin:only password */}
        <StatCard label="Two-factor" icon={<ShieldCheckIcon />} value={user.twoFactorEnabled ? "On" : "Off"} /> {/* klin:only two-factor */}
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Getting started</CardTitle>
            <CardDescription>A few things worth doing first.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              {checklist.map((item, index) => (
                <li key={index} className="flex items-start gap-3 text-sm">
                  {item.done ? (
                    <CheckCircle2Icon className="mt-0.5 size-4 shrink-0 text-brand" />
                  ) : (
                    <CircleIcon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                  )}
                  <span className={item.done ? "text-muted-foreground line-through" : undefined}>{item.label}</span>
                  {!item.done && item.action && <span className="ml-auto shrink-0">{item.action}</span>}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
        <Card className="relative overflow-hidden lg:col-span-2">
          <div className="bg-glow absolute inset-0 opacity-60" />
          <CardHeader className="relative">
            <div className="mb-1 grid size-9 place-items-center rounded-lg bg-brand text-brand-foreground">
              <TerminalIcon className="size-5" />
            </div>
            <CardTitle>One command, one feature</CardTitle>
            <CardDescription>
              Schema, database model, API module, data hooks and a page — generated together and wired up.
            </CardDescription>
          </CardHeader>
          <CardContent className="relative">
            <pre className="overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-xs text-zinc-100">
              pnpm klin generate resource billing/invoice
            </pre>
            <Button variant="link" className="mt-2 px-0" render={<Link to="/notes" />}>
              See the Notes example <ArrowRightIcon />
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  )
}

function StatCard({ label, value, icon }: { label: string; value: ReactNode; icon: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardDescription className="flex items-center gap-2 [&_svg]:size-4">
          {icon} {label}
        </CardDescription>
        <CardTitle className="text-2xl tabular-nums">
          {value === undefined ? <Skeleton className="h-8 w-16" /> : value}
        </CardTitle>
      </CardHeader>
    </Card>
  )
}
