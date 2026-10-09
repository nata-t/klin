#!/usr/bin/env node
/**
 * Keeps the template installable under package managers that refuse very new
 * releases (pnpm 11 defaults to minimumReleaseAge = 1 day).
 *
 *   node scripts/check-dep-ages.mjs          # report
 *   node scripts/check-dep-ages.mjs --fix    # lower floors that are too fresh
 *
 * For every `^x.y.z` in template/**\/package.json whose x.y.z was published
 * less than MIN_DAYS ago, suggests the newest same-major version that's old
 * enough.
 */
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { globSync } from "node:fs"

const MIN_DAYS = 3
const fix = process.argv.includes("--fix")
const now = Date.now()
const cache = new Map()

function times(name) {
  if (!cache.has(name)) {
    const raw = execFileSync("npm", ["view", name, "time", "--json"], { encoding: "utf8" })
    cache.set(name, JSON.parse(raw))
  }
  return cache.get(name)
}

const cmp = (a, b) => {
  const pa = a.split(/[.-]/).map(Number)
  const pb = b.split(/[.-]/).map(Number)
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i]
  return 0
}

let problems = 0
for (const file of globSync("template/**/package.json", { exclude: (p) => p.includes("node_modules") })) {
  const pkg = JSON.parse(readFileSync(file, "utf8"))
  let changed = false
  for (const field of ["dependencies", "devDependencies"]) {
    for (const [name, range] of Object.entries(pkg[field] ?? {})) {
      const match = /^([\^~])(\d+)\.(\d+)\.(\d+)$/.exec(range)
      if (!match) continue
      const [, op, major] = match
      const version = range.slice(1)
      const published = times(name)[version]
      if (!published) continue
      const ageDays = (now - Date.parse(published)) / 86_400_000
      if (ageDays >= MIN_DAYS) continue
      const candidates = Object.entries(times(name))
        .filter(([v, t]) => /^\d+\.\d+\.\d+$/.test(v) && v.split(".")[0] === major && (now - Date.parse(t)) / 86_400_000 >= MIN_DAYS)
        .map(([v]) => v)
        .sort(cmp)
      const replacement = candidates.at(-1)
      problems++
      console.log(`${file}: ${name}@${version} is ${ageDays.toFixed(1)} days old → ${replacement ? op + replacement : "(no older same-major release)"}`)
      if (fix && replacement) {
        pkg[field][name] = op + replacement
        changed = true
      }
    }
  }
  if (changed) writeFileSync(file, JSON.stringify(pkg, null, 2) + "\n")
}
console.log(problems ? `${problems} fresh floor(s)${fix ? " fixed where possible" : ""}` : "All dependency floors are old enough ✨")
