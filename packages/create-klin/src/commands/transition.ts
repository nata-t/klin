import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs"
import { rm, unlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import * as p from "@clack/prompts"
import { diff3Merge } from "node-diff3"
import { cliDependency, resolveTemplate, VERSION } from "../context"
import {
  type Answers,
  loadManifest,
  type Manifest,
  normalizeAnswers,
  selectedOptions,
} from "../engine/manifest"
import { type FileMap, render } from "../engine/render"
import { box } from "../ui/box"
import { INSTALL_QUIPS, task } from "../ui/task"
import { accent, brand, gradient, pc, sym } from "../ui/theme"
import { type ChangeKind, fileTree } from "../ui/tree"
import { mergeEnv } from "../utils/env-file"
import { run } from "../utils/exec"
import { writeFileMap } from "../utils/fs"
import { pmCommands } from "../utils/pm"
import { findProjectRoot, parsePackageManager, type ProjectConfig, readProject, writeProject } from "../utils/project"
import { bail, type Flags, guard } from "./flags"

/**
 * How `klin add`, `klin remove` and `klin upgrade` work:
 *
 *   base   = the template rendered with the project's current options
 *   target = the template rendered with the new options (or a newer template)
 *   ours   = the files in the project right now
 *
 * For every file: if you never touched it, it's simply replaced; if you did,
 * the base→target change is 3-way merged into your version (like `git merge`).
 * Real conflicts get standard conflict markers for you to resolve.
 */

interface Side {
  templateDir: string
  manifest: Manifest
  answers: Answers
}

interface Change {
  path: string
  kind: ChangeKind
  content?: string | Buffer
  note?: string
}

export async function addCommand(flags: Flags) {
  await changeModules(flags, "add")
}

export async function removeCommand(flags: Flags) {
  await changeModules(flags, "remove")
}

function loadProject() {
  const root = findProjectRoot()
  if (!root) bail("This isn't a klin project (no klin.json found here or above).")
  return { root, config: readProject(root) }
}

async function changeModules(flags: Flags, mode: "add" | "remove") {
  const { root, config } = loadProject()
  const template = resolveTemplate(config.template === "bundled" ? undefined : config.template, root)
  const manifest = loadManifest(template.dir)
  const requested = flags._

  p.intro(`${brand(` klin ${mode} `)} ${pc.dim(config.name)}`)

  let modules = requested
  if (modules.length === 0) {
    const current = new Set(selectedOptions(manifest, config.answers))
    const choices = manifest.questions
      .flatMap((q) => q.options.map((id) => ({ id, q })))
      .filter(({ id, q }) =>
        mode === "add" ? !current.has(id) && q.id !== "accent" : current.has(id) && q.type === "multiselect"
      )
    if (choices.length === 0) bail(mode === "add" ? "Every module is already on — spotless!" : "Nothing to remove.")
    modules = guard(
      await p.multiselect({
        message: mode === "add" ? "What should we bolt on?" : "What should we take out?",
        options: choices.map(({ id }) => ({ value: id, label: manifest.options[id]!.label, hint: manifest.options[id]!.hint })),
        required: true,
      })
    )
  }

  const next: Answers = structuredClone(config.answers)
  for (const id of modules) {
    const question = manifest.questions.find((q) => q.options.includes(id))
    if (!question) bail(`Unknown module "${id}". Run ${pc.cyan("klin list")} to see them all.`)
    if (question.type === "select") {
      if (mode === "remove") bail(`"${id}" can't be removed — switch to another ${question.id} with \`klin add <other>\` instead.`)
      next[question.id] = id
    } else {
      const list = new Set((next[question.id] as string[]) ?? [])
      if (mode === "add") list.add(id)
      else list.delete(id)
      next[question.id] = [...list]
    }
  }

  let normalized
  try {
    normalized = normalizeAnswers(manifest, next)
  } catch (error) {
    bail((error as Error).message)
  }
  for (const note of normalized.notes) p.log.info(note)

  // Removing something another module requires would be undone by normalization.
  if (mode === "remove") {
    const still = selectedOptions(manifest, normalized.answers)
    const blocked = modules.filter((id) => still.includes(id))
    if (blocked.length) bail(`${blocked.join(", ")} is still required by another module you have on.`)
  }

  if (JSON.stringify(normalized.answers) === JSON.stringify(config.answers)) {
    p.outro(`${sym.sparkle} Nothing to do — ${modules.join(", ")} ${mode === "add" ? "is already on" : "isn't on"}.`)
    return
  }

  await transition({
    root,
    config,
    flags,
    base: { templateDir: template.dir, manifest, answers: config.answers },
    target: { templateDir: template.dir, manifest, answers: normalized.answers },
    title: `${mode === "add" ? "Adding" : "Removing"} ${modules.map((m) => manifest.options[m]?.label ?? m).join(", ")}`,
    newVersion: config.version,
  })
}

export async function upgradeCommand(flags: Flags) {
  const { root, config } = loadProject()
  p.intro(`${brand(" klin upgrade ")} ${pc.dim(`${config.name} · made with v${config.version}`)}`)
  p.log.warn(`${pc.bold("Experimental.")} Commit or stash your work first so you can review the result with git diff.`)

  const current = resolveTemplate(config.template === "bundled" ? undefined : config.template, root)
  let baseDir: string
  let cleanup: (() => Promise<void>) | undefined

  if (flags.from) {
    baseDir = resolveTemplate(flags.from, process.cwd()).dir
  } else if (config.template !== "bundled") {
    bail("Upgrading a project made from a custom template needs --from <old template dir>.")
  } else if (config.version === VERSION) {
    p.outro(`${sym.sparkle} Already on the latest template (v${VERSION}).`)
    return
  } else {
    const fetched = await task(`Fetching the v${config.version} template to compare against`, async () => fetchTemplate(config.version))
    baseDir = fetched.dir
    cleanup = fetched.cleanup
  }

  try {
    const baseManifest = loadManifest(baseDir)
    const targetManifest = loadManifest(current.dir)
    const { answers } = normalizeAnswers(targetManifest, config.answers)
    await transition({
      root,
      config,
      flags,
      base: { templateDir: baseDir, manifest: baseManifest, answers: config.answers },
      target: { templateDir: current.dir, manifest: targetManifest, answers },
      title: `Upgrading v${config.version} → v${VERSION}`,
      newVersion: VERSION,
    })
  } finally {
    await cleanup?.()
  }
}

function fetchTemplate(version: string) {
  const dir = mkdtempSync(join(tmpdir(), "klin-upgrade-"))
  try {
    const file = execFileSync("npm", ["pack", `create-klin@${version}`, "--pack-destination", dir, "--silent"], {
      encoding: "utf8",
    }).trim()
    execFileSync("tar", ["-xzf", join(dir, file), "-C", dir])
  } catch {
    throw new Error(`Couldn't download create-klin@${version} to compare against. Pass --from <dir> instead.`)
  }
  return { dir: join(dir, "package/template"), cleanup: () => rm(dir, { recursive: true, force: true }) }
}

async function transition(options: {
  root: string
  config: ProjectConfig
  flags: Flags
  base: Side
  target: Side
  title: string
  newVersion: string
}) {
  const { root, config, flags } = options
  const { pm, version } = parsePackageManager(config.packageManager)
  const common = { pm, pmVersion: version, name: config.name, cliDependency: readCliDependency(root) }

  const [base, target] = await task("Rendering before & after", () =>
    Promise.all([
      render({ ...common, ...options.base }),
      render({ ...common, ...options.target }),
    ])
  )

  const changes = planChanges(root, base, target)
  const visible = changes.filter((c) => c.kind !== "keep" && c.kind !== "skip")
  const skipped = changes.filter((c) => c.kind === "skip")

  if (visible.length === 0) {
    p.outro(`${sym.sparkle} Nothing to change.`)
    return
  }

  p.log.step(options.title)
  console.log(fileTree(visible.map(({ path, kind, note }) => ({ path, kind, note }))))
  console.log(
    `\n  ${pc.green("+ new")}  ${pc.cyan("~ updated/merged")}  ${pc.yellow("! needs your eyes")}  ${pc.red("- removed")}\n`
  )
  for (const s of skipped) p.log.info(`${pc.dim("Skipped")} ${s.path} ${pc.dim(`— ${s.note}`)}`)

  if (flags["dry-run"]) {
    p.outro(pc.dim("Dry run — nothing was written."))
    return
  }
  if (!flags.yes && process.stdin.isTTY) {
    const ok = guard(await p.confirm({ message: "Apply these changes?", initialValue: true }))
    if (!ok) bail("Nothing changed.")
  }

  await task("Applying changes", async () => {
    const writes: FileMap = new Map()
    const deleted: string[] = []
    for (const change of changes) {
      if (change.kind === "delete") {
        await unlink(join(root, change.path)).catch(() => {})
        deleted.push(change.path)
      } else if (change.content !== undefined && change.kind !== "keep" && change.kind !== "skip") {
        writes.set(change.path, { content: change.content, mode: target.get(change.path)?.mode ?? 0o644 })
      }
    }
    await writeFileMap(root, writes)
    await pruneDirectories(root, deleted)
  }, { done: () => `Applied ${visible.length} change${visible.length === 1 ? "" : "s"}` })

  // New env vars from the new .env.example (with fresh secrets where needed).
  const envPath = join(root, ".env")
  const example = target.get(".env.example")?.content.toString()
  if (example && existsSync(envPath)) {
    const merged = mergeEnv(readFileSync(envPath, "utf8"), example, options.target.manifest.env?.generate ?? {})
    if (merged.added.length) {
      await writeFile(envPath, merged.text)
      p.log.info(`Added to .env: ${merged.added.map((k) => pc.cyan(k)).join(", ")}`)
    }
  }

  writeProject(root, { ...config, version: options.newVersion, answers: options.target.answers })

  const run_ = pmCommands(pm).run
  const depsChanged = changes.some((c) => c.path.endsWith("package.json") && c.kind !== "keep")
  if (depsChanged && flags.install !== false) {
    await task(`Installing dependencies with ${pm}`, async () => {
      const result = await run(pm, ["install"], { cwd: root })
      if (result.code !== 0) throw new Error(result.output.split("\n").slice(-10).join("\n"))
    }, { quips: INSTALL_QUIPS, done: () => "Dependencies are up to date" }).catch((error: Error) => {
      p.log.warn(`Install failed — run ${pc.cyan(pmCommands(pm).install)} yourself.\n${pc.dim(error.message)}`)
    })
    await run(pm, ["run", "db:generate"], { cwd: root })
  }

  const conflicts = changes.filter((c) => c.kind === "conflict")
  const schemaChanged = changes.some((c) => c.path.startsWith("packages/db/prisma/") && c.kind !== "keep")
  const lines: string[] = []
  if (conflicts.length) {
    lines.push(`${pc.yellow(sym.warn)} ${pc.bold(`${conflicts.length} file(s) need a look`)} — search for ${pc.yellow("<<<<<<<")}:`)
    for (const c of conflicts) lines.push(`   ${pc.yellow(c.path)}`)
    lines.push("")
  }
  if (schemaChanged) lines.push(`${accent(sym.arrow)} ${pc.bold(run_("db:migrate"))}  ${pc.dim("the database schema changed")}`)
  if (depsChanged && flags.install === false) lines.push(`${accent(sym.arrow)} ${pc.bold(pmCommands(pm).install)}`)
  lines.push(`${accent(sym.arrow)} ${pc.bold(run_("dev"))}  ${pc.dim("and take a look")}`)
  lines.push(`${accent(sym.arrow)} ${pc.bold("git diff")}  ${pc.dim("review everything that changed")}`)
  console.log(box(lines, { title: conflicts.length ? "almost spotless" : `${sym.sparkle} done` }))

  const notes = selectedOptions(options.target.manifest, options.target.answers)
    .filter((id) => !selectedOptions(options.base.manifest, options.base.answers).includes(id))
    .map((id) => options.target.manifest.options[id]?.note)
    .filter(Boolean) as string[]
  for (const note of notes) p.log.info(note)
  p.outro(gradient(conflicts.length ? "Resolve the markers and you're done." : "All tidy."))
}

/**
 * After deleting files: a workspace package that lost its package.json also
 * loses its build leftovers, then any directories left empty are removed.
 */
async function pruneDirectories(root: string, deleted: string[]) {
  for (const path of deleted) {
    if (!path.endsWith("/package.json")) continue
    const dir = join(root, dirname(path))
    for (const leftover of ["node_modules", ".turbo", "dist", "coverage"]) {
      await rm(join(dir, leftover), { recursive: true, force: true })
    }
  }
  const dirs = [...new Set(deleted.flatMap((path) => {
    const parts = path.split("/").slice(0, -1)
    return parts.map((_, i) => parts.slice(0, i + 1).join("/"))
  }))].sort((a, b) => b.length - a.length)
  for (const dir of dirs) {
    const abs = join(root, dir)
    if (existsSync(abs) && readdirSync(abs).length === 0) await rm(abs, { recursive: true, force: true })
  }
}

/** Reads the create-klin spec the project already uses, so renders match it exactly. */
function readCliDependency(root: string) {
  try {
    const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as {
      devDependencies?: Record<string, string>
    }
    return pkg.devDependencies?.["create-klin"] ?? cliDependency()
  } catch {
    return cliDependency()
  }
}

const text = (file: { content: string | Buffer } | undefined) =>
  file === undefined ? undefined : Buffer.isBuffer(file.content) ? file.content : file.content.toString()

function same(a: string | Buffer | undefined, b: string | Buffer | undefined) {
  if (a === undefined || b === undefined) return a === b
  return Buffer.from(a).equals(Buffer.from(b))
}

export function planChanges(root: string, base: FileMap, target: FileMap): Change[] {
  const paths = new Set([...base.keys(), ...target.keys()])
  const changes: Change[] = []

  for (const path of [...paths].sort()) {
    const before = text(base.get(path))
    const after = text(target.get(path))
    if (same(before, after)) continue

    const abs = join(root, path)
    const ours = existsSync(abs) ? readFileSync(abs) : undefined
    const oursText = ours?.toString()

    // Removed from the template.
    if (after === undefined) {
      if (ours === undefined) continue
      if (same(ours, before)) changes.push({ path, kind: "delete" })
      else changes.push({ path, kind: "skip", note: "you edited it, so it stays" })
      continue
    }

    // New in the template.
    if (before === undefined) {
      if (ours === undefined) changes.push({ path, kind: "create", content: after })
      else if (same(ours, after)) changes.push({ path, kind: "keep" })
      else changes.push(mergeFile(path, oursText!, "", after.toString()))
      continue
    }

    // Changed in the template.
    if (ours === undefined) {
      changes.push({ path, kind: "skip", note: "you deleted it" })
    } else if (same(ours, before)) {
      changes.push({ path, kind: "update", content: after })
    } else if (same(ours, after)) {
      changes.push({ path, kind: "keep" })
    } else if (Buffer.isBuffer(after)) {
      changes.push({ path, kind: "skip", note: "binary file you changed" })
    } else {
      changes.push(mergeFile(path, oursText!, before.toString(), after.toString()))
    }
  }
  return changes
}

/**
 * 3-way merge with one extra rule: when both sides only *inserted* lines at the
 * same spot (the base had nothing there), keep both — yours first. That's what
 * happens next to `klin-anchor` comments, where `klin generate` and
 * `klin add` both append imports and modules, and it isn't a real conflict.
 */
export function mergeText(ours: string, base: string, theirs: string) {
  const split = (s: string) => (s === "" ? [] : s.split("\n"))
  const out: string[] = []
  let conflicts = 0
  for (const block of diff3Merge(split(ours), split(base), split(theirs))) {
    if (block.ok) {
      out.push(...block.ok)
      continue
    }
    const { a, o, b } = block.conflict!
    if (o.length === 0) {
      out.push(...a, ...b.filter((line) => !a.includes(line)))
      continue
    }
    conflicts++
    out.push("<<<<<<< yours", ...a, "=======", ...b, ">>>>>>> klin")
  }
  return { content: out.join("\n"), conflicts }
}

function mergeFile(path: string, ours: string, base: string, theirs: string): Change {
  const { content, conflicts } = mergeText(ours, base, theirs)
  return conflicts
    ? { path, kind: "conflict", content, note: `${conflicts} conflict${conflicts === 1 ? "" : "s"} inside` }
    : { path, kind: "merge", content, note: "merged with your edits" }
}
