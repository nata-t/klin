import { resolveTemplate } from "../context"
import { loadManifest, selectedOptions } from "../engine/manifest"
import { intro, outro } from "../ui/log"
import { c, padEnd, swatch, sym } from "../ui/theme"
import { findProjectRoot, readProject } from "../utils/project"
import type { Flags } from "./flags"

/** Every module the template offers, with ✓ for what this project has on. */
export async function listCommand(_flags: Flags) {
  const root = findProjectRoot()
  const config = root ? readProject(root) : null
  const template = resolveTemplate(config && config.template !== "bundled" ? config.template : undefined, root ?? undefined)
  const manifest = loadManifest(template.dir)
  const on = new Set(config ? selectedOptions(manifest, config.answers) : [])

  intro("klin list", c.dim(config ? config.name : "template modules"))
  for (const question of manifest.questions) {
    console.log(`\n  ${c.white(question.title ?? question.id)} ${c.dim(question.type === "select" ? "(pick one)" : "")}`)
    for (const id of question.options) {
      const option = manifest.options[id]!
      const mark = on.has(id) ? c.white(sym.check) : c.faint(sym.dot)
      const label = on.has(id) ? c.bright(option.label) : c.muted(option.label)
      const color = option.swatch ? `${swatch(option.swatch)} ` : ""
      console.log(`    ${mark} ${color}${padEnd(label, 26)} ${c.dim(id)}${option.hint ? c.faint(` — ${option.hint}`) : ""}`)
    }
  }
  console.log()
  outro(
    config
      ? `Add one: ${c.code("klin add <id>")} ${c.dim("·")} remove: ${c.code("klin remove <id>")}`
      : c.dim("Run this inside a klin project to see what's switched on.")
  )
}
