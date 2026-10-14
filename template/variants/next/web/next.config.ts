import { existsSync } from "node:fs"
import path from "node:path"
import type { NextConfig } from "next"
import { apiUrl } from "./src/lib/api-url"

const root = path.resolve(import.meta.dirname, "../..")

// One .env at the repo root for every app (real environment variables win).
const rootEnv = path.join(root, ".env")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const nextConfig: NextConfig = {
  // klin:if docker
  // The Docker image builds a self-contained server in .next/standalone;
  // `next start` runs the regular build.
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  // klin:endif
  // The monorepo root, where Turbopack and the build find workspace packages.
  outputFileTracingRoot: root,
  turbopack: { root },
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@repo/auth",
    "@repo/ui", // klin:only packages-ui
    "@repo/validators",
  ],
  // <Link href> and router.push() only accept routes that exist.
  typedRoutes: true,
  // Next's dev tools button goes bottom right; TanStack Query's sits bottom left.
  devIndicators: { position: "bottom-right" },
  // Same-origin API: the browser only ever talks to this origin, and /api is
  // forwarded to the API. Auth cookies stay first-party, no CORS.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl()}/api/:path*` }]
  },
}

export default nextConfig
