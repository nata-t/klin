import * as p from "@clack/prompts"
import type { Answers, Manifest } from "../engine/manifest"
import { pc } from "../ui/theme"

export interface Flags {
  _: string[]
  help?: boolean
  version?: boolean
  yes?: boolean
  force?: boolean
  "dry-run"?: boolean
  install?: boolean
  git?: boolean
  banner?: boolean
  ui?: boolean
  api?: boolean
  pm?: string
  preset?: string
  template?: string
  plural?: string
  scope?: string
  from?: string
  cwd?: string
  [key: string]: unknown
}

export const FLAG_SPEC = {
  boolean: ["help", "version", "yes", "force", "dry-run", "install", "git", "banner", "ui", "api"],
  string: ["pm", "preset", "template", "plural", "scope", "from", "cwd", "backend", "server", "auth", "plugins", "db", "security", "extras", "components", "accent"],
  alias: { h: "help", v: "version", y: "yes", f: "force", t: "template", p: "preset" },
  default: { install: true, git: true, banner: true, ui: true, api: true },
}

/** `--auth google,github --db sqlite --extras none` → answers. */
export function answersFromFlags(manifest: Manifest, flags: Flags): Answers {
  const answers: Answers = {}
  for (const question of manifest.questions) {
    const raw = flags[question.flag ?? question.id]
    if (raw === undefined || raw === true) continue
    const value = String(raw).trim()
    if (question.type === "select") {
      answers[question.id] = value
    } else {
      answers[question.id] =
        value === "" || value === "none"
          ? []
          : value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean)
    }
  }
  return answers
}

/** Unwraps a clack prompt result, exiting cleanly on Ctrl+C. */
export function guard<T>(value: T): Exclude<T, symbol> {
  if (p.isCancel(value)) {
    p.cancel("Swept under the rug — nothing changed.")
    process.exit(0)
  }
  return value as Exclude<T, symbol>
}

export function bail(message: string): never {
  p.cancel(pc.red(message))
  process.exit(1)
}
