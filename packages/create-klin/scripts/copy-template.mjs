/**
 * Copies ../../template into ./template for publishing. npm drops files named
 * .gitignore/.npmrc from tarballs, so they're stored as _gitignore/_npmrc and
 * renamed back when a project is scaffolded.
 */
import { cpSync, existsSync, renameSync, rmSync } from "node:fs"
import { basename, dirname, join, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { globSync } from "node:fs"

const here = dirname(fileURLToPath(import.meta.url))
const source = resolve(here, "../../../template")
const target = resolve(here, "../template")

const SKIP = /(^|\/)(node_modules|dist|\.turbo|generated|playwright-report|test-results)(\/|$)|(^|\/)\.env$|\.db(-journal)?$|\.tsbuildinfo$|routeTree\.gen\.ts$|(pnpm-lock\.yaml|bun\.lockb?|package-lock\.json)$/

rmSync(target, { recursive: true, force: true })
cpSync(source, target, {
  recursive: true,
  filter: (src) => !SKIP.test(relative(source, src).split("\\").join("/")),
})

for (const file of globSync("**/{.gitignore,.npmrc,.npmignore}", { cwd: target })) {
  const abs = join(target, file)
  renameSync(abs, join(dirname(abs), `_${basename(abs).slice(1)}`))
}

if (!existsSync(join(target, "klin.template.json"))) throw new Error("template copy failed")
console.log(`template → ${relative(process.cwd(), target)}`)
