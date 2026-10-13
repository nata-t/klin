import { readFileSync } from "node:fs"
import { join } from "node:path"
import { evaluate, identifiers, type FlagSet } from "./expr"

/**
 * `klin.template.json` — a template describes its own questions, options,
 * derived flags and strip rules. The CLI is just an engine: fork the template,
 * add an option + some markers, and `create-klin --template ./my-template`
 * picks it up with prompts and all.
 */

export type PackageManager = "pnpm" | "bun" | "npm"
/** In the order the CLI offers them — bun is the default. */
export const PACKAGE_MANAGERS: PackageManager[] = ["bun", "pnpm", "npm"]

/** `{ "apps/api/package.json": { "dependencies": ["bullmq"], "trustedDependencies": true } }` */
export type JsonStrip = Record<string, Record<string, true | string[]>>

/** `{ "apps/web/package.json": { "dependencies": { "@repo/ui": "workspace:*" } } }` — deep-merged in. */
export type JsonMerge = Record<string, Record<string, unknown>>

/** Literal text replaced in rendered files whose output path matches `files`. */
export interface ReplaceSpec {
  files: string | string[]
  from: string
  to: string
}

export interface OptionSpec {
  label: string
  hint?: string
  /** Options that are switched on automatically when this one is. */
  requires?: string[]
  /** Globs (relative to the template root) removed when the option is OFF. */
  remove?: string[]
  /** JSON keys removed when the option is OFF. */
  json?: JsonStrip
  /** A short line shown in the summary/next steps when this option is on. */
  note?: string
  /**
   * Two or three sentences shown while the option is highlighted in the
   * interactive CLI: what it is and how it gets set up.
   */
  about?: string
  /** A CSS color (hex or oklch) the CLI previews next to the option. */
  swatch?: string
  /**
   * A warning the interactive CLI shows (in amber) while the option is
   * switched off: what you give up without it.
   */
  warnOff?: string
}

export interface QuestionSpec {
  id: string
  type: "select" | "multiselect"
  message: string
  /** Shown in `--help` and used as the CLI flag name (`--auth google,github`). */
  flag?: string
  options: string[]
  default: string | string[]
  /** multiselect only: at least one option must be picked. */
  required?: boolean
  /** Flags derived from this question are `${flagPrefix}${option}`. */
  flagPrefix?: string
  /** Skip in the interactive flow unless the user opts into "customize". */
  advanced?: boolean
  /** Short label for the option group in the interactive CLI ("Database"). */
  title?: string
  /** Optional visual sub-groups for a long option list (same options, split up). */
  groups?: Array<{ title: string; options: string[] }>
}

export interface RuleSpec {
  when: string
  remove?: string[]
  json?: JsonStrip
  /** Keys deep-merged into JSON files (package.json, components.json, …). */
  merge?: JsonMerge
  /**
   * Output path remaps, applied after `remove`: `{ "apps/api/plain/": "apps/api/src/" }`
   * moves a folder (keys ending in "/"), `{ "a/b.ts": "c/d.ts" }` moves a file.
   */
  move?: Record<string, string>
  /** Text replacements in the rendered files, matched by output path. */
  replace?: ReplaceSpec[]
}

/** A page of the interactive CLI: a heading plus the questions shown on it. */
export interface StepSpec {
  id: string
  title: string
  heading: string
  subtitle?: string
  questions: string[]
}

export interface PresetSpec {
  label: string
  hint?: string
  /** Shown while the preset is highlighted in the interactive CLI. */
  about?: string
  answers: Answers
}

export interface Manifest {
  name: string
  description?: string
  /** Literal strings in the template replaced with a form of the project name. */
  tokens: Record<string, "slug" | "snake" | "title" | "pascal" | "camel">
  questions: QuestionSpec[]
  options: Record<string, OptionSpec>
  flags?: Record<string, string>
  rules?: RuleSpec[]
  /** How the interactive CLI groups questions into pages (defaults to one per question). */
  steps?: StepSpec[]
  presets?: Record<string, PresetSpec>
  env?: {
    /** Keys whose example value is replaced by a random one in the generated `.env`. */
    generate?: Record<string, "secret" | "password">
  }
  /** Files that should never be copied (in addition to the defaults). */
  ignore?: string[]
}

export type Answers = Record<string, string | string[]>

export const MANIFEST_FILE = "klin.template.json"

export function loadManifest(templateDir: string): Manifest {
  const raw = readFileSync(join(templateDir, MANIFEST_FILE), "utf8")
  const manifest = JSON.parse(raw) as Manifest
  validateManifest(manifest)
  return manifest
}

function fail(message: string): never {
  throw new Error(`Invalid ${MANIFEST_FILE}: ${message}`)
}

export function validateManifest(m: Manifest) {
  if (!m.name) fail("missing name")
  if (!Array.isArray(m.questions)) fail("questions must be an array")
  const known = knownFlags(m)
  for (const q of m.questions) {
    for (const o of q.options) {
      if (!m.options[o]) fail(`question "${q.id}" lists unknown option "${o}"`)
    }
    const defaults = Array.isArray(q.default) ? q.default : [q.default]
    for (const d of defaults) {
      if (!q.options.includes(d)) fail(`question "${q.id}" has default "${d}" that isn't one of its options`)
    }
  }
  for (const [id, spec] of Object.entries(m.options)) {
    for (const r of spec.requires ?? []) {
      if (!m.options[r]) fail(`option "${id}" requires unknown option "${r}"`)
    }
  }
  const checkExpr = (expr: string, where: string) => {
    for (const ident of identifiers(expr)) {
      if (!known.has(ident)) fail(`${where} references unknown flag "${ident}"`)
    }
  }
  for (const [name, expr] of Object.entries(m.flags ?? {})) checkExpr(expr, `flag "${name}"`)
  for (const rule of m.rules ?? []) checkExpr(rule.when, `rule "${rule.when}"`)
  for (const q of m.questions) {
    for (const group of q.groups ?? []) {
      for (const o of group.options) {
        if (!q.options.includes(o)) fail(`question "${q.id}" groups option "${o}" that isn't one of its options`)
      }
    }
  }
  if (m.steps) {
    const placed = new Set<string>()
    for (const step of m.steps) {
      for (const id of step.questions) {
        if (!m.questions.some((q) => q.id === id)) fail(`step "${step.id}" lists unknown question "${id}"`)
        if (placed.has(id)) fail(`question "${id}" appears in more than one step`)
        placed.add(id)
      }
    }
    const missing = m.questions.filter((q) => !placed.has(q.id)).map((q) => q.id)
    if (missing.length) fail(`questions missing from steps: ${missing.join(", ")}`)
  }
}

/** The interactive pages: the manifest's own, or one page per question. */
export function stepsFor(m: Manifest): StepSpec[] {
  return (
    m.steps ??
    m.questions.map((q) => ({ id: q.id, title: q.title ?? q.id, heading: q.message, questions: [q.id] }))
  )
}

/** The flag name an option produces (select questions may prefix it). */
export function flagFor(m: Manifest, optionId: string): string {
  const q = m.questions.find((q) => q.options.includes(optionId))
  return `${q?.flagPrefix ?? ""}${optionId}`
}

export function knownFlags(m: Manifest): Set<string> {
  const known = new Set<string>(PACKAGE_MANAGERS)
  for (const q of m.questions) for (const o of q.options) known.add(flagFor(m, o))
  for (const name of Object.keys(m.flags ?? {})) known.add(name)
  return known
}

export function defaultAnswers(m: Manifest): Answers {
  const answers: Answers = {}
  for (const q of m.questions) {
    answers[q.id] = Array.isArray(q.default) ? [...q.default] : q.default
  }
  return answers
}

export interface Normalized {
  answers: Answers
  /** Human-readable notes about options that were switched on automatically. */
  notes: string[]
}

/**
 * Fills in missing answers with defaults, validates values, and switches on
 * options required by the ones that were picked.
 */
export function normalizeAnswers(m: Manifest, input: Answers): Normalized {
  const answers: Answers = defaultAnswers(m)
  const notes: string[] = []

  for (const q of m.questions) {
    const value = input[q.id]
    if (value === undefined) continue
    if (q.type === "select") {
      const v = Array.isArray(value) ? value[0] : value
      if (v === undefined || !q.options.includes(v)) {
        throw new Error(
          `"${v}" isn't a valid choice for --${q.flag ?? q.id}. Pick one of: ${q.options.join(", ")}`
        )
      }
      answers[q.id] = v
    } else {
      const list = (Array.isArray(value) ? value : [value]).filter(Boolean)
      for (const v of list) {
        if (!q.options.includes(v)) {
          throw new Error(
            `"${v}" isn't a valid choice for --${q.flag ?? q.id}. Pick from: ${q.options.join(", ")}`
          )
        }
      }
      answers[q.id] = [...new Set(list)]
    }
  }

  // Requirement closure: keep adding until nothing changes.
  let changed = true
  while (changed) {
    changed = false
    for (const id of selectedOptions(m, answers)) {
      for (const req of m.options[id]?.requires ?? []) {
        if (selectedOptions(m, answers).includes(req)) continue
        const q = m.questions.find((q) => q.options.includes(req))
        if (!q) continue
        if (q.type === "select") answers[q.id] = req
        else answers[q.id] = [...((answers[q.id] as string[]) ?? []), req]
        notes.push(`${m.options[req]!.label} was switched on because ${m.options[id]!.label} needs it`)
        changed = true
      }
    }
  }

  for (const q of m.questions) {
    if (q.type === "multiselect" && q.required && (answers[q.id] as string[]).length === 0) {
      throw new Error(`Pick at least one option for --${q.flag ?? q.id}`)
    }
    // Keep a stable order so klin.json diffs stay quiet.
    if (q.type === "multiselect") {
      const picked = new Set(answers[q.id] as string[])
      answers[q.id] = q.options.filter((o) => picked.has(o))
    }
  }

  return { answers, notes }
}

/** Every option id that is on, across all questions. */
export function selectedOptions(m: Manifest, answers: Answers): string[] {
  const out: string[] = []
  for (const q of m.questions) {
    const v = answers[q.id]
    if (v === undefined) continue
    out.push(...(Array.isArray(v) ? v : [v]))
  }
  return out
}

export function resolveFlags(m: Manifest, answers: Answers, pm: PackageManager): FlagSet {
  const known = knownFlags(m)
  const on = new Set<string>([pm])
  for (const id of selectedOptions(m, answers)) on.add(flagFor(m, id))

  // Derived flags may depend on each other; iterate to a fixed point.
  const derived = Object.entries(m.flags ?? {})
  for (let pass = 0; pass <= derived.length; pass++) {
    let added = false
    for (const [name, expr] of derived) {
      if (!on.has(name) && evaluate(expr, { on, known })) {
        on.add(name)
        added = true
      }
    }
    if (!added) break
  }
  return { on, known }
}
