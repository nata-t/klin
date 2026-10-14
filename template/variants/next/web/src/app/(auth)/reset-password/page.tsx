// klin:file password
import type { Metadata } from "next"
import { ResetPasswordPage } from "@/features/auth/reset-password-page"

export const metadata: Metadata = { title: "Reset password" }

export default function Page() {
  return <ResetPasswordPage />
}
