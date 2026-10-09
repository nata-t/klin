import { createFileRoute } from "@tanstack/react-router"
import { ApiKeysCard } from "@/features/api-keys/api-keys-card"

export const Route = createFileRoute("/_app/settings/api-keys")({
  staticData: { title: "API keys" },
  component: ApiKeysCard,
})
