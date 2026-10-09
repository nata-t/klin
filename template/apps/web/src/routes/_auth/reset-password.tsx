// klin:file password
import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { ResetPasswordPage } from "@/features/auth/reset-password-page"

export const Route = createFileRoute("/_auth/reset-password")({
  // Better Auth sends people here with ?token=… (or ?error=INVALID_TOKEN).
  validateSearch: z.object({ token: z.string().optional(), error: z.string().optional() }),
  staticData: { title: "Reset password" },
  component: ResetPasswordPage,
})
