import * as p from "@clack/prompts"
import { resolveTemplate } from "../context"
import { loadManifest, selectedOptions } from "../engine/manifest"
import { brand, pc, sym } from "../ui/theme"
import { findProjectRoot, readProject } from "../utils/project"
import type { Flags } from "./flags"

const TITLES: Record<string, string> = {
  auth: "Sign-in",
  plugins: "Better Auth power-ups",
  database: "Database",
  extras: "Extras",
  accent: "UI accent",
}

/** Every module the template offers, with ✔ for what this project has on. */
export async function listCommand(_flags: Flags) {
  const root = findProjectRoot()
  const config = root ? readProject(root) : null
  const template = resolveTemplate(config && config.template !== "bundled" ? config.template : undefined, root ?? undefined)
  const manifest = loadManifest(template.dir)
  const on = new Set(config ? selectedOptions(manifest, config.answers) : [])

  p.intro(`${brand(" klin list ")} ${pc.dim(config ? config.name : "template modules")}`)
  for (const question of manifest.questions) {
    console.log(`\n  ${pc.bold(TITLES[question.id] ?? question.id)} ${pc.dim(question.type === "select" ? "(pick one)" : "")}`)
    for (const id of question.options) {
      const option = manifest.options[id]!
      const mark = on.has(id) ? pc.green(sym.check) : pc.dim(sym.dot)
      const label = on.has(id) ? option.label : pc.dim(option.label)
      console.log(`    ${mark} ${label.padEnd(26)} ${pc.dim(id)}${option.hint ? pc.dim(` — ${option.hint}`) : ""}`)
    }
  }
  console.log()
  p.outro(
    config
      ? `Add one: ${pc.cyan("klin add <id>")} ${pc.dim("·")} remove: ${pc.cyan("klin remove <id>")}`
      : pc.dim("Run this inside a klin project to see what's switched on.")
  )
}
