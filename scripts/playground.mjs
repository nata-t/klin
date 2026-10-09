#!/usr/bin/env node
/**
 * Render + install a preset into .playground/ with the locally built CLI.
 *
 *   pnpm playground                       # recommended, pnpm
 *   pnpm playground saas bun              # preset, package manager
 *   pnpm playground minimal npm --db mysql --extras none
 *
 * Re-running replaces the folder. Run `pnpm build` first.
 */
import { spawnSync } from "node:child_process"
import { existsSync, mkdirSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const cli = join(root, "packages/create-klin/dist/index.js")
if (!existsSync(cli)) {
  console.error("Build the CLI first: pnpm build")
  process.exit(1)
}

const [preset = "recommended", pm = "pnpm", ...extra] = process.argv.slice(2)
const dir = join(root, ".playground")
mkdirSync(dir, { recursive: true })

const result = spawnSync(
  process.execPath,
  [cli, `${preset}-${pm}`, "--preset", preset, "--pm", pm, "--yes", "--force", "--no-banner", ...extra],
  { cwd: dir, stdio: "inherit" }
)
process.exit(result.status ?? 1)
