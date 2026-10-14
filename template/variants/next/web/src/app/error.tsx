"use client"

import { RouteError } from "@/components/route-error"

/** Anything that throws while rendering a page lands here ("Try again" re-renders it). */
export default function ErrorPage(props: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError {...props} />
}
