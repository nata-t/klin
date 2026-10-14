// klin:file two-factor
import type { Metadata } from "next"
import { TwoFactorPage } from "@/features/auth/two-factor-page"

export const metadata: Metadata = { title: "Two-factor authentication" }

export default function Page() {
  return <TwoFactorPage />
}
