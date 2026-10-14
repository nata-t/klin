// klin:file password
import type { Metadata } from "next"
import { ForgotPasswordPage } from "@/features/auth/forgot-password-page"

export const metadata: Metadata = { title: "Forgot password" }

export default function Page() {
  return <ForgotPasswordPage />
}
