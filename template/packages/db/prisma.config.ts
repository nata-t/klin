import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { defineConfig } from "prisma/config"

/**
 * Prisma CLI config (generate, migrate, studio). The app itself connects in
 * src/client.ts. Reads DATABASE_URL from the repo-root .env.
 */

function findRepoRoot() {
  let dir = process.cwd()
  while (!existsSync(join(dir, "turbo.json"))) {
    const parent = dirname(dir)
    if (parent === dir) return process.cwd()
    dir = parent
  }
  return dir
}

const root = findRepoRoot()
if (existsSync(join(root, ".env"))) process.loadEnvFile(join(root, ".env"))

function databaseUrl() {
  const url = process.env.DATABASE_URL
  if (!url) return undefined
  // SQLite: relative file: paths are relative to the repo root, everywhere.
  if (url.startsWith("file:") && !url.startsWith("file:/")) {
    return `file:${resolve(root, url.slice("file:".length))}`
  }
  return url
}

const url = databaseUrl()

export default defineConfig({
  schema: "prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // `prisma generate` doesn't need a database; everything else does.
  ...(url ? { datasource: { url } } : {}),
})
