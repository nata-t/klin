import { createFileRoute, Outlet, redirect } from "@tanstack/react-router"

/** Admin area guard: the parent `_app` guard already put the session in context. */
export const Route = createFileRoute("/_app/admin")({
  beforeLoad: ({ context }) => {
    if (context.session.user.role !== "admin") throw redirect({ to: "/dashboard" })
  },
  component: Outlet,
})
