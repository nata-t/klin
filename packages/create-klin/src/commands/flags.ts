import type { Answers, Manifest } from "../engine/manifest"
import { cancel } from "../ui/log"
import { isCancel } from "../ui/prompts"
import { c } from "../ui/theme"

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
  pm?: string
  preset?: string
  template?: string
  from?: string
  cwd?: string
  url?: string
  plural?: string
  [key: string]: unknown
}

export const FLAG_SPEC = {
  boolean: ["help", "version", "yes", "force", "dry-run", "install", "git", "banner", "validation", "model", "route", "nav", "reset"],
  string: [
    "pm",
    "preset",
    "template",
    "from",
    "cwd",
    "url",
    "plural",
    "backend-dir",
    "frontend-dir",
    "validation-dir",
    "model-dir",
    "backend",
    "server",
    "db",
    "auth",
    "plugins",
    "security",
    "extras",
    "components",
    "accent",
  ],
  alias: { h: "help", v: "version", y: "yes", f: "force", t: "template", p: "preset" },
  default: { install: true, git: true, banner: true },
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

/** Unwraps a prompt result, exiting cleanly on Ctrl+C / Esc. */
export function guard<T>(value: T): Exclude<T, symbol> {
  if (isCancel(value)) {
    cancel("Swept under the rug — nothing changed.")
    process.exit(0)
  }
  return value as Exclude<T, symbol>
}

export function bail(message: string): never {
  cancel(c.error(message))
  process.exit(1)
}
