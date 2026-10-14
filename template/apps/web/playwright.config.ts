import { existsSync } from "node:fs"
import path from "node:path"
import { defineConfig, devices } from "@playwright/test"

/**
 * End-to-end tests run against production builds of both apps:
 *   pnpm build && pnpm test:e2e
 * Needs a database (pnpm db:up && pnpm db:push for a fresh one).
 */
const rootEnv = path.resolve(import.meta.dirname, "../../.env")
if (existsSync(rootEnv)) process.loadEnvFile(rootEnv)

const webURL = process.env.WEB_URL ?? "http://localhost:5173"
const apiPort = process.env.API_PORT ?? "3000"

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: webURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node --enable-source-maps ../api/dist/main.js",
      url: `http://localhost:${apiPort}/api/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: "vite preview", // klin:only vite
      //? command: `next start --port ${new URL(webURL).port || 5173}`, // klin:only next
      //? env: { NODE_ENV: "production" }, // klin:only next
      url: webURL,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
