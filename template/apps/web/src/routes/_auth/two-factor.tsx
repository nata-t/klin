import { createFileRoute } from "@tanstack/react-router"
import { TwoFactorPage } from "@/features/auth/two-factor-page"

export const Route = createFileRoute("/_auth/two-factor")({
  staticData: { title: "Two-factor authentication" },
  component: TwoFactorPage,
})
