import type { ReactNode } from "react"

export function AuthHeader({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="text-sm text-balance text-muted-foreground">{description}</p>}
    </div>
  )
}

export function AuthDivider({ children = "or" }: { children?: ReactNode }) {
  return (
    <div className="relative text-center text-xs text-muted-foreground uppercase after:absolute after:inset-0 after:top-1/2 after:z-0 after:flex after:items-center after:border-t">
      <span className="relative z-10 bg-background px-2">{children}</span>
    </div>
  )
}
