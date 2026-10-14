import { resolveTemplate } from "../context"
import { loadManifest, selectedOptions } from "../engine/manifest"
import { centeredBlock, intro, outro } from "../ui/log"
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
  // One block, so every question's options line up.
  const lines: string[] = []
  for (const question of manifest.questions) {
    const kind = question.locked ? "(picked when the project is created)" : question.type === "select" ? "(pick one)" : ""
    lines.push(`${c.white(question.title ?? question.id)} ${c.dim(kind)}`)
    for (const id of question.options) {
      const option = manifest.options[id]!
      const mark = on.has(id) ? c.white(sym.check) : c.faint(sym.dot)
      const label = on.has(id) ? c.bright(option.label) : c.muted(option.label)
      const color = option.swatch ? `${swatch(option.swatch)} ` : ""
      lines.push(`  ${mark} ${color}${padEnd(label, 26)} ${c.dim(id)}${option.hint ? c.faint(` — ${option.hint}`) : ""}`)
    }
    lines.push("")
  }
  centeredBlock(lines)
  outro(
    config
      ? `Add one: ${c.code("klin add <id>")} ${c.dim("·")} remove: ${c.code("klin remove <id>")}`
      : c.dim("Run this inside a klin project to see what's switched on.")
  )
}
