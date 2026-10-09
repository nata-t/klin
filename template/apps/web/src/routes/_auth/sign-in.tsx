import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { SignInPage } from "@/features/auth/sign-in-page"

export const Route = createFileRoute("/_auth/sign-in")({
  validateSearch: z.object({ redirect: z.string().optional() }),
  staticData: { title: "Sign in" },
  component: SignInPage,
})
