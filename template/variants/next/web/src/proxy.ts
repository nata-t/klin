import { getSessionCookie } from "better-auth/cookies"
import { type NextRequest, NextResponse } from "next/server"

/**
 * The first check for signed-in pages, before anything renders: no session
 * cookie → off to /sign-in, remembering where you were going. It only looks
 * for the cookie; the (app) layout asks the API whether the session is real.
 * `klin generate` adds new pages to the matcher.
 */
export function proxy(request: NextRequest) {
  if (getSessionCookie(request)) return NextResponse.next()
  const signIn = new URL("/sign-in", request.url)
  signIn.searchParams.set("redirect", request.nextUrl.pathname + request.nextUrl.search)
  return NextResponse.redirect(signIn)
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/notes/:path*",
    "/settings/:path*",
    "/admin/:path*", // klin:only admin
    "/accept-invitation/:path*", // klin:only organizations
    // klin-anchor:protected-routes
  ],
}
