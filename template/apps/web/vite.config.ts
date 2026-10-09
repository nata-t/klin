import path from "node:path"
import tailwindcss from "@tailwindcss/vite"
import { tanstackRouter } from "@tanstack/router-plugin/vite"
import react from "@vitejs/plugin-react"
import { defineConfig, loadEnv } from "vite"

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
    ],
    resolve: {
      alias: { "@": path.resolve(import.meta.dirname, "src") },
    },
    server: { port: webPort, strictPort: true, proxy },
    preview: { port: webPort, strictPort: true, proxy },
  }
})
