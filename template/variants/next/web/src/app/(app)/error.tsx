"use client"

import { RouteError } from "@/components/route-error"

/** Errors in signed-in pages render inside the app shell, so the sidebar stays. */
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />
}
