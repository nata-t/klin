import { readFile, stat } from "node:fs/promises"
import { join, basename } from "node:path"
import picomatch from "picomatch"
import { glob } from "tinyglobby"
import type { FlagSet } from "./expr"
import { evaluate } from "./expr"
import {
  flagFor,
  type Answers,
  type JsonMerge,
  type JsonStrip,
  type Manifest,
  type PackageManager,
  MANIFEST_FILE,
  type ReplaceSpec,
  resolveFlags,
} from "./manifest"
import { processMarkers } from "./markers"
import { camel, pascal, snake, title, toSlug } from "../utils/names"
import { rewriteCommand, rewriteMarkdown } from "../utils/pm"

export interface RenderInput {
  templateDir: string
  manifest: Manifest
  answers: Answers
  pm: PackageManager
  pmVersion: string
  /** Project name as typed by the user. */
  name: string
  /**
   * Version spec for create-klin itself (e.g. "^0.1.0"). When set, the root
   * package.json gets it as a devDependency plus a `klin` script, so
   * `pnpm klin add …` works inside the project.
   */
  cliDependency?: string
}

export interface RenderedFile {
  content: string | Buffer
  mode: number
}

/** path (posix, relative to the project root) → file */
export type FileMap = Map<string, RenderedFile>

const DEFAULT_IGNORE = [
  "**/node_modules/**",
  "**/dist/**",
  "**/.turbo/**",
  "**/src/generated/**",
  "**/.env",
  "**/.env.local",
  "**/*.tsbuildinfo",
  "**/routeTree.gen.ts",
  "**/playwright-report/**",
  "**/test-results/**",
  "**/*.db",
  "**/*.db-journal",
  "**/pnpm-lock.yaml",
  "**/bun.lock",
  "**/bun.lockb",
  "**/package-lock.json",
  "**/.DS_Store",
  MANIFEST_FILE,
]

const BINARY = /\.(png|jpe?g|gif|webp|ico|icns|avif|woff2?|ttf|otf|eot|mp4|webm|mp3|wav|zip|gz|pdf|wasm)$/i

/** npm strips these from published tarballs, so the published template stores them renamed. */
const RENAMES: Record<string, string> = {
  _gitignore: ".gitignore",
  _npmrc: ".npmrc",
  _npmignore: ".npmignore",
}

export function projectTokens(manifest: Manifest, name: string): Array<[string, string]> {
  const slug = toSlug(name.split("/").pop() ?? name) || "my-app"
  const forms = {
    slug,
    snake: snake(slug),
    title: title(slug),
    pascal: pascal(slug),
    camel: camel(slug),
  }
  // Longest token first so "klin-app-web" style tokens can't be half-replaced.
  return Object.entries(manifest.tokens)
    .sort(([a], [b]) => b.length - a.length)
    .map(([token, form]) => [token, forms[form]])
}

function applyTokens(text: string, tokens: Array<[string, string]>) {
  let out = text
  for (const [token, value] of tokens) {
    if (out.includes(token)) out = out.split(token).join(value)
  }
  return out
}

function stripJson(obj: Record<string, unknown>, spec: Record<string, true | string[]>) {
  for (const [key, what] of Object.entries(spec)) {
    if (what === true) {
      delete obj[key]
      continue
    }
    const section = obj[key]
    if (section && typeof section === "object" && !Array.isArray(section)) {
      for (const sub of what) delete (section as Record<string, unknown>)[sub]
      if (Object.keys(section).length === 0) delete obj[key]
    } else if (Array.isArray(section)) {
      obj[key] = section.filter((item) => !what.includes(String(item)))
    }
  }
}

function mergeStrip(into: JsonStrip, from: JsonStrip | undefined) {
  for (const [file, spec] of Object.entries(from ?? {})) {
    const target = (into[file] ??= {})
    for (const [key, what] of Object.entries(spec)) {
      const existing = target[key]
      if (what === true || existing === true) target[key] = true
      else target[key] = [...(existing ?? []), ...what]
    }
  }
}

function mergeJson(target: Record<string, unknown>, patch: Record<string, unknown>) {
  for (const [key, value] of Object.entries(patch)) {
    const existing = target[key]
    if (value && typeof value === "object" && !Array.isArray(value) && existing && typeof existing === "object" && !Array.isArray(existing)) {
      mergeJson(existing as Record<string, unknown>, value as Record<string, unknown>)
    } else {
      target[key] = structuredClone(value)
    }
  }
}

/** Collects the strip, merge, move and replace rules that apply for this set of flags. */
function collectRules(manifest: Manifest, flags: FlagSet) {
  const remove: string[] = []
  const json: JsonStrip = {}
  const merge: JsonMerge = {}
  const moves: Array<[string, string]> = []
  const replace: ReplaceSpec[] = []
  for (const [id, spec] of Object.entries(manifest.options)) {
    if (flags.on.has(flagFor(manifest, id))) continue
    remove.push(...(spec.remove ?? []))
    mergeStrip(json, spec.json)
  }
  for (const rule of manifest.rules ?? []) {
    if (!evaluate(rule.when, flags)) continue
    remove.push(...(rule.remove ?? []))
    mergeStrip(json, rule.json)
    for (const [file, patch] of Object.entries(rule.merge ?? {})) mergeJson((merge[file] ??= {}), patch)
    moves.push(...Object.entries(rule.move ?? {}))
    replace.push(...(rule.replace ?? []))
  }
  // Most specific first, so "a/b/" wins over "a/".
  moves.sort(([a], [b]) => b.length - a.length)
  return { remove, json, merge, moves, replace }
}

function sortDependencies(pkg: Record<string, unknown>) {
  for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
    const deps = pkg[field] as Record<string, string> | undefined
    if (deps) pkg[field] = Object.fromEntries(Object.entries(deps).sort(([a], [b]) => a.localeCompare(b)))
  }
}

/** Applies the first matching move: folder prefixes end in "/", anything else is a single file. */
function movePath(path: string, moves: Array<[string, string]>) {
  for (const [from, to] of moves) {
    if (from.endsWith("/") ? path.startsWith(from) : path === from) return to + path.slice(from.length)
  }
  return path
}

async function listTemplate(templateDir: string, manifest: Manifest) {
  const paths = await glob("**/*", {
    cwd: templateDir,
    dot: true,
    onlyFiles: true,
    ignore: [...DEFAULT_IGNORE, ...(manifest.ignore ?? [])],
    expandDirectories: false,
  })
  return paths.sort()
}

function transformPackageJson(
  pkg: Record<string, unknown>,
  path: string,
  input: RenderInput
): Record<string, unknown> {
  const scripts = pkg.scripts as Record<string, string> | undefined
  if (scripts) {
    for (const [key, value] of Object.entries(scripts)) scripts[key] = rewriteCommand(value, input.pm)
  }
  if (input.pm === "npm") {
    for (const field of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const deps = pkg[field] as Record<string, string> | undefined
      if (!deps) continue
      for (const [dep, range] of Object.entries(deps)) {
        if (range.startsWith("workspace:")) deps[dep] = "*"
      }
    }
  }
  if (path === "package.json") {
    if ("packageManager" in pkg) pkg.packageManager = `${input.pm}@${input.pmVersion}`
    if (input.cliDependency) {
      pkg.scripts = { ...(pkg.scripts as object), klin: "klin" }
      const dev = { ...(pkg.devDependencies as Record<string, string>), "create-klin": input.cliDependency }
      pkg.devDependencies = Object.fromEntries(Object.entries(dev).sort(([a], [b]) => a.localeCompare(b)))
    }
  }
  return pkg
}

/**
 * Renders the template for a set of answers into memory. Pure with respect to
 * its inputs: the same template + answers always produce the same files, which
 * is what makes `klin add` / `klin remove` 3-way merges possible.
 */
export async function render(input: RenderInput): Promise<FileMap> {
  const { templateDir, manifest } = input
  const flags = resolveFlags(manifest, input.answers, input.pm)
  const rules = collectRules(manifest, flags)
  const isRemoved = picomatch(rules.remove.length ? rules.remove : ["\0never"], { dot: true })
  const replacements = rules.replace.map((spec) => ({ ...spec, matches: picomatch(spec.files, { dot: true }) }))
  const tokens = projectTokens(manifest, input.name)
  const paths = await listTemplate(templateDir, manifest)

  const files: FileMap = new Map()
  const origin = new Map<string, string>()

  for (const sourcePath of paths) {
    const renamed = sourcePath
      .split("/")
      .map((segment) => RENAMES[segment] ?? segment)
      .join("/")
    if (isRemoved(renamed) || isRemoved(sourcePath)) continue

    const outPath = movePath(renamed, rules.moves)
    const clash = origin.get(outPath)
    if (clash) throw new Error(`Template files ${clash} and ${sourcePath} both render to ${outPath}`)

    const abs = join(templateDir, sourcePath)
    const { mode } = await stat(abs)

    if (BINARY.test(outPath)) {
      files.set(outPath, { content: await readFile(abs), mode })
      origin.set(outPath, sourcePath)
      continue
    }

    const original = await readFile(abs, "utf8")
    let text = processMarkers(original, flags, sourcePath)
    // Drop files the markers emptied — but keep ones that are empty on purpose (.gitkeep).
    if (text === null || (text.trim() === "" && original.trim() !== "")) continue

    text = applyTokens(text, tokens)
    for (const { matches, from, to } of replacements) {
      if (matches(outPath) && text.includes(from)) text = text.split(from).join(to)
    }

    const name = basename(outPath)
    if (outPath.endsWith(".md") || outPath.endsWith(".mdx")) {
      text = rewriteMarkdown(text, input.pm)
    } else if (outPath.startsWith(".husky/") || outPath.endsWith(".sh")) {
      text = rewriteCommand(text, input.pm)
    }

    const strip = rules.json[outPath]
    const patch = rules.merge[outPath]
    if (name === "package.json" || strip || patch) {
      let obj = JSON.parse(text) as Record<string, unknown>
      if (patch) {
        mergeJson(obj, patch)
        if (name === "package.json") sortDependencies(obj)
      }
      if (strip) stripJson(obj, strip)
      if (name === "package.json") obj = transformPackageJson(obj, outPath, input)
      text = `${JSON.stringify(obj, null, 2)}\n`
    }

    files.set(outPath, { content: text, mode })
    origin.set(outPath, sourcePath)
  }

  return files
}
