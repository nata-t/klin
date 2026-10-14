// klin:file api-keys
import type { Metadata } from "next"
import { ApiKeysCard } from "@/features/api-keys/api-keys-card"

export const metadata: Metadata = { title: "API keys" }

export default function Page() {
  return <ApiKeysCard />
}
