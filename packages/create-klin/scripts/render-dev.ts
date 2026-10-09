/**
 * Dev harness: render the template without the interactive CLI.
 *   pnpm tsx scripts/render-dev.ts <outDir> <preset> [pm] [json-overrides]
 */
import { mkdir, rm, writeFile, chmod } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { loadManifest, normalizeAnswers, type PackageManager } from "../src/engine/manifest"
import { render } from "../src/engine/render"

const [outDir, preset = "everything", pm = "pnpm", overrides = "{}"] = process.argv.slice(2)
if (!outDir) throw new Error("usage: render-dev <outDir> [preset] [pm] [overrides]")
const templateDir = resolve(import.meta.dirname, "../../../template")
const manifest = loadManifest(templateDir)
const base = manifest.presets?.[preset]?.answers ?? {}
const { answers, notes } = normalizeAnswers(manifest, { ...base, ...JSON.parse(overrides) })
const files = await render({ templateDir, manifest, answers, pm: pm as PackageManager, pmVersion: "11.20.0", name: "klin-playground" })
await rm(outDir, { recursive: true, force: true })
for (const [path, file] of files) {
  const abs = join(outDir, path)
  await mkdir(dirname(abs), { recursive: true })
  await writeFile(abs, file.content)
  await chmod(abs, file.mode)
}
console.log(`rendered ${files.size} files → ${outDir}`, notes)
console.log(JSON.stringify(answers))
