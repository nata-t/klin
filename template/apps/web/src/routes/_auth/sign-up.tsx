import { createFileRoute } from "@tanstack/react-router"
import { SignUpPage } from "@/features/auth/sign-up-page"

export const Route = createFileRoute("/_auth/sign-up")({
  staticData: { title: "Create account" },
  component: SignUpPage,
})
