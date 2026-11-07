/**
 * The service worker (/sw.js), rendered once per build. Its bytes change with
 * every build (the build's time is in it), which is how browsers notice a new
 * version: it installs next to the old one and waits, and the app offers a
 * reload (src/lib/pwa.ts). Hashed build files are cached on first use; pages and
 * /api always go to the network, so nobody's data outlives a sign-out.
 */
export const dynamic = "force-static"

const version = Date.now().toString(36)

const worker = `const CACHE = "static-${version}"

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key.startsWith("static-") && key !== CACHE).map((key) => caches.delete(key)))
    )
  )
})

// The app asks the waiting worker to take over when someone picks "Reload".
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") self.skipWaiting()
})

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)
  if (event.request.method !== "GET" || url.origin !== self.location.origin || !url.pathname.startsWith("/_next/static/")) return
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(event.request)
      if (cached) return cached
      const response = await fetch(event.request)
      if (response.ok) await cache.put(event.request, response.clone())
      return response
    })
  )
})
`

export function GET() {
  return new Response(worker, {
    headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-cache" },
  })
}
