import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"
import { VitePWA } from "vite-plugin-pwa" // klin:only pwa
import { siteConfig } from "./src/config/site" // klin:only pwa

const root = path.resolve(import.meta.dirname, "../..")

export default defineConfig(({ mode }) => {
  // One .env at the repo root for every app.
  const env = loadEnv(mode, root, "")
  const webPort = Number(new URL(env.WEB_URL || "http://localhost:5173").port) || 5173

  // Same-origin API: the browser only ever talks to the web origin, and /api
  // is forwarded to Nest. Auth cookies stay first-party, no CORS in dev.
  const proxy = {
    "/api": { target: `http://localhost:${env.API_PORT || 3000}` },
  }

  return {
    envDir: root,
    plugins: [
      // File-based routing: src/routes/** → src/routeTree.gen.ts
      tanstackRouter({ target: "react", autoCodeSplitting: true }),
      react(),
      tailwindcss(),
      // klin:if pwa
      // Installable app: the web manifest, and a service worker (dist/sw.js) that precaches the
      // build. A new version waits until the app says so, so people get a "reload" toast instead of
      // a surprise; src/lib/pwa.ts registers it in production builds.
      VitePWA({
        registerType: "prompt",
        injectRegister: false,
        includeAssets: ["favicon.svg", "apple-touch-icon.png"],
        manifest: {
          name: siteConfig.name,
          short_name: siteConfig.name,
          description: siteConfig.description,
          start_url: "/",
          scope: "/",
          display: "standalone",
          theme_color: "#0a0a0a",
          background_color: "#0a0a0a",
          icons: [
            { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
            { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
            { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}"],
          // Pages fall back to the app shell offline; the API never does (and its
          // responses aren't cached, so nobody's data outlives a sign-out).
          navigateFallbackDenylist: [/^\/api\//],
        },
        // Serves the manifest in dev too, so the install prompt can be tried with `dev`.
        devOptions: { enabled: true },
      }),
      // klin:endif
    ],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    server: { port: webPort, strictPort: true, proxy },
    preview: { port: webPort, strictPort: true, proxy },
  }
})
