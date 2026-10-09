import { existsSync, readFileSync } from "node:fs"
import { rm, writeFile } from "node:fs/promises"
import { basename, join, relative, resolve } from "node:path"
import * as p from "@clack/prompts"
import { cliDependency, resolveTemplate, VERSION } from "../context"
import {
  type Answers,
  loadManifest,
  type Manifest,
  normalizeAnswers,
  PACKAGE_MANAGERS,
  type PackageManager,
  type QuestionSpec,
} from "../engine/manifest"
import { render } from "../engine/render"
import { banner } from "../ui/banner"
import { box, table } from "../ui/box"
import { INSTALL_QUIPS, task } from "../ui/task"
import { accent, brand, gradient, pc, pick, swatch, sym } from "../ui/theme"
import { fileTree } from "../ui/tree"
import { generateEnv } from "../utils/env-file"
import { run } from "../utils/exec"
import { isEmptyDir, writeFileMap } from "../utils/fs"
import { isValidPackageName, toSlug } from "../utils/names"
import { detectInvokingPm, FALLBACK_PM_VERSIONS, pmCommands, pmVersion } from "../utils/pm"
import { PROJECT_FILE, projectFileContent, type ProjectConfig } from "../utils/project"
import type { Flags } from "./flags"
import { answersFromFlags, bail, guard } from "./flags"

const ACCENT_HEX: Record<string, string> = {
  violet: "#7c3aed",
  blue: "#2563eb",
  emerald: "#059669",
  rose: "#e11d48",
  amber: "#f59e0b",
  neutral: "#a3a3a3",
}

const SIGN_OFFS = [
  "Go build something lovely.",
  "Now go make a mess — we'll help tidy up.",
  "Fresh sheets, clean slate. Have fun!",
  "Everything's in its place. Your move.",
  "Spotless. Ship something great.",
]

export async function create(flags: Flags) {
  if (flags.banner !== false) await banner(VERSION)
  p.intro(`${brand(" create-klin ")} ${pc.dim("let's set up your project")}`)

  const interactive = !flags.yes && process.stdin.isTTY
  const template = resolveTemplate(flags.template)
  const manifest = loadManifest(template.dir)

  /* ─── Name & directory ─────────────────────────────────────────────── */
  let name = flags._[0] && flags._[0] !== "create" && flags._[0] !== "new" ? flags._[0] : flags._[1]
  if (!name) {
    name = interactive
      ? guard(
          await p.text({
            message: "What should we call it?",
            placeholder: "my-klin-app",
            defaultValue: "my-klin-app",
            validate: (value) => {
              const slug = toSlug(basename(value || "my-klin-app"))
              if (!slug || !isValidPackageName(slug)) return "Use letters, numbers and dashes"
            },
          })
        )
      : "my-klin-app"
  }
  const targetDir = resolve(flags.cwd ?? process.cwd(), name)
  const projectName = toSlug(basename(targetDir))
  if (!projectName || !isValidPackageName(projectName)) bail(`"${name}" isn't a valid project name`)

  if (!isEmptyDir(targetDir)) {
    if (flags.force) {
      // handled below, after confirmation of the recipe
    } else if (interactive) {
      const wipe = guard(
        await p.confirm({
          message: `${pc.cyan(relative(process.cwd(), targetDir) || ".")} isn't empty. Sweep it clean first? ${pc.dim("(deletes everything inside)")}`,
          initialValue: false,
        })
      )
      if (!wipe) bail("Leaving that folder alone. Pick another name and try again.")
      flags.force = true
    } else {
      bail(`${targetDir} isn't empty — use --force to overwrite it`)
    }
  }

  /* ─── Features ─────────────────────────────────────────────────────── */
  const fromFlags = answersFromFlags(manifest, flags)
  let input: Answers = { ...(flags.preset ? presetAnswers(manifest, flags.preset) : {}), ...fromFlags }

  const askEverything = interactive && !flags.preset && Object.keys(fromFlags).length === 0
  if (askEverything) {
    const presetId = guard(
      await p.select({
        message: "Start from a preset?",
        options: [
          ...Object.entries(manifest.presets ?? {}).map(([id, preset]) => ({
            value: id,
            label: preset.label,
            hint: preset.hint,
          })),
          { value: "custom", label: "Custom", hint: "pick every option yourself" },
        ],
        initialValue: "recommended",
      })
    )
    if (presetId === "custom") {
      for (const question of manifest.questions) input[question.id] = await ask(manifest, question)
    } else {
      input = { ...presetAnswers(manifest, presetId) }
      const accentQuestion = manifest.questions.find((q) => q.id === "accent")
      if (accentQuestion) input.accent = await ask(manifest, accentQuestion)
    }
  } else if (interactive) {
    // Flags covered some questions; ask the rest.
    for (const question of manifest.questions) {
      if (input[question.id] === undefined && !flags.preset) input[question.id] = await ask(manifest, question)
    }
  }

  let normalized
  try {
    normalized = normalizeAnswers(manifest, input)
  } catch (error) {
    bail((error as Error).message)
  }
  const { answers, notes } = normalized

  /* ─── Package manager ──────────────────────────────────────────────── */
  const pm = await choosePackageManager(flags, interactive)
  const version = pmVersion(pm) ?? FALLBACK_PM_VERSIONS[pm]

  /* ─── Recipe ───────────────────────────────────────────────────────── */
  console.log(recipe(manifest, answers, projectName, pm, version))
  for (const note of notes) p.log.info(note)

  if (interactive) {
    const go = guard(await p.confirm({ message: "Looks spotless?", initialValue: true }))
    if (!go) bail("No worries — nothing was created.")
  }

  /* ─── Scaffold ─────────────────────────────────────────────────────── */
  const files = await task(
    "Sweeping the template",
    () =>
      render({
        templateDir: template.dir,
        manifest,
        answers,
        pm,
        pmVersion: version,
        name: projectName,
        cliDependency: cliDependency(),
      }),
    { done: (f) => `Swept ${pc.bold(String(f.size))} files into shape` }
  )

  const config: ProjectConfig = {
    version: VERSION,
    template: template.source,
    name: projectName,
    packageManager: `${pm}@${version}`,
    answers,
  }

  if (flags["dry-run"]) {
    p.log.step(`Dry run — this is what ${pc.cyan(projectName)} would contain:`)
    console.log(fileTree([...files.keys(), PROJECT_FILE, ".env"].map((path) => ({ path, kind: "create" as const }))))
    p.outro(pc.dim("Nothing was written."))
    return
  }

  if (flags.force && existsSync(targetDir)) await rm(targetDir, { recursive: true, force: true })

  await task("Laying everything out", async () => {
    await writeFileMap(targetDir, files)
    await writeFile(join(targetDir, PROJECT_FILE), projectFileContent(config))
    const example = files.get(".env.example")?.content.toString()
    if (example) await writeFile(join(targetDir, ".env"), generateEnv(example, manifest.env?.generate ?? {}))
  }, { done: () => `Wrote ${pc.cyan(relative(process.cwd(), targetDir) || ".")} with a fresh ${pc.bold(".env")} ${pc.dim("(new secrets, just for you)")}` })

  /* ─── Git, install, generate ───────────────────────────────────────── */
  const git = flags.git !== false && (await gitAvailable(targetDir))
  if (git) {
    await task("Initializing git", async () => {
      const result = await run("git", ["init", "-b", "main"], { cwd: targetDir })
      if (result.code !== 0) await run("git", ["init"], { cwd: targetDir })
    }, { done: () => "Initialized a git repository" })
  }

  const commands = pmCommands(pm)
  let installed = false
  if (flags.install !== false) {
    installed = await installDependencies(targetDir, pm)
    if (installed) {
      await task("Generating the Prisma client", async () => {
        const result = await run(pm, ["run", "db:generate"], { cwd: targetDir })
        if (result.code !== 0) throw new Error(result.output)
      }, { done: () => "Generated the Prisma client" }).catch(() => {
        p.log.warn(`Couldn't run prisma generate — run ${pc.cyan(commands.run("db:generate"))} yourself.`)
      })
    }
  }

  if (git) {
    await task("Making the first commit", async () => {
      await run("git", ["add", "-A"], { cwd: targetDir })
      const result = await run(
        "git",
        ["commit", "--no-verify", "-m", "chore: initial commit from create-klin ✨"],
        { cwd: targetDir }
      )
      if (result.code !== 0) throw new Error("commit failed")
    }, { done: () => "Committed the initial state" }).catch(() => {
      p.log.info(pc.dim("Skipped the initial commit (is git user.name/email set?)"))
    })
  }

  /* ─── Next steps ───────────────────────────────────────────────────── */
  const installFailed = flags.install !== false && !installed
  console.log(nextSteps({ manifest, answers, targetDir, pm, installed, installFailed }))
  const optionNotes = Object.values(answers)
    .flat()
    .map((id) => manifest.options[id]?.note)
    .filter(Boolean) as string[]
  for (const note of optionNotes) p.log.info(note)

  p.outro(
    installFailed
      ? pc.yellow("Almost there — rerun the install once the problem above is fixed.")
      : gradient(`${sym.sparkle} ${pick(SIGN_OFFS)}`)
  )
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function presetAnswers(manifest: Manifest, id: string): Answers {
  const preset = manifest.presets?.[id]
  if (!preset) {
    bail(`Unknown preset "${id}". Try: ${Object.keys(manifest.presets ?? {}).join(", ")}`)
  }
  return { ...preset.answers }
}

async function ask(manifest: Manifest, question: QuestionSpec): Promise<string | string[]> {
  const label = (id: string) => {
    const option = manifest.options[id]!
    return question.id === "accent" ? `${swatch(ACCENT_HEX[id] ?? "#888")} ${option.label}` : option.label
  }
  const options = question.options.map((id) => ({
    value: id,
    label: label(id),
    hint: manifest.options[id]?.hint,
  }))

  if (question.type === "select") {
    return guard(
      await p.select({
        message: question.message,
        options,
        initialValue: question.default as string,
      })
    )
  }
  return guard(
    await p.multiselect({
      message: `${question.message} ${pc.dim("(space to toggle)")}`,
      options,
      initialValues: question.default as string[],
      required: question.required ?? false,
    })
  )
}

async function choosePackageManager(flags: Flags, interactive: boolean): Promise<PackageManager> {
  if (flags.pm) {
    if (!PACKAGE_MANAGERS.includes(flags.pm as PackageManager)) bail(`--pm must be one of ${PACKAGE_MANAGERS.join(", ")}`)
    return flags.pm as PackageManager
  }
  const invoking = detectInvokingPm()
  if (!interactive) return invoking ?? (pmVersion("pnpm") ? "pnpm" : "npm")

  const installed = PACKAGE_MANAGERS.filter((pm) => pmVersion(pm))
  const initial = invoking && installed.includes(invoking) ? invoking : installed.includes("pnpm") ? "pnpm" : (installed[0] ?? "npm")
  return guard(
    await p.select({
      message: "Which package manager?",
      options: PACKAGE_MANAGERS.map((pm) => ({
        value: pm,
        label: pm,
        hint: pmVersion(pm) ? `v${pmVersion(pm)}` : "not installed",
        disabled: !pmVersion(pm),
      })),
      initialValue: initial,
    })
  )
}

function optionLabels(manifest: Manifest, ids: string[] | string | undefined) {
  const list = (Array.isArray(ids) ? ids : ids ? [ids] : []).map((id) => manifest.options[id]?.label ?? id)
  return list.length ? list.join(", ") : pc.dim("none")
}

function recipe(manifest: Manifest, answers: Answers, name: string, pm: PackageManager, version: string) {
  const rows: Array<[string, string]> = [
    ["name", pc.bold(name)],
    ["stack", "NestJS · Better Auth · Prisma · TanStack · shadcn/ui"],
  ]
  const labels: Record<string, string> = {
    auth: "sign-in",
    plugins: "power-ups",
    database: "database",
    extras: "extras",
    accent: "vibe",
  }
  for (const question of manifest.questions) {
    const value = answers[question.id]
    const text =
      question.id === "accent"
        ? `${swatch(ACCENT_HEX[value as string] ?? "#888")} ${optionLabels(manifest, value)}`
        : optionLabels(manifest, value)
    rows.push([labels[question.id] ?? question.id, text])
  }
  rows.push(["tooling", `${pm} ${pc.dim(`v${version}`)}`])
  return box(table(rows), { title: "🧾 your recipe" })
}

async function gitAvailable(dir: string) {
  const version = await run("git", ["--version"], { cwd: process.cwd() })
  if (version.code !== 0) return false
  // Don't nest a repo inside another one (e.g. scaffolding inside a monorepo).
  const inside = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: resolve(dir, "..") })
  return inside.code !== 0
}

async function installDependencies(dir: string, pm: PackageManager) {
  if (!pmVersion(pm)) {
    p.log.warn(`${pm} isn't installed, so dependencies weren't installed. Install ${pm} and run ${pc.cyan(pmCommands(pm).install)}.`)
    return false
  }
  try {
    await task(
      `Installing dependencies with ${pm}`,
      async (update) => {
        const result = await run(pm, ["install"], {
          cwd: dir,
          onLine: (line) => {
            const match = /Progress: resolved (\d+)/.exec(line) ?? /Resolving: total (\d+)/.exec(line)
            if (match) update(`· ${match[1]} packages resolved`)
          },
        })
        if (result.code !== 0) {
          const error = new Error("install failed") as Error & { output: string }
          error.output = result.output
          throw error
        }
      },
      { quips: INSTALL_QUIPS, done: () => `Installed dependencies with ${pm}` }
    )
    return true
  } catch (error) {
    const output = (error as { output?: string }).output ?? String(error)
    p.log.error(`${pm} install hit a snag. Last lines:\n${pc.dim(output.split("\n").slice(-15).join("\n"))}`)
    const hint = /ENOSPC|no space left/i.test(output)
      ? "The disk (or /tmp) is full — free some space."
      : /ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|failed to resolve|network/i.test(output)
        ? "Looks like a network or registry problem — check your connection (or free space in /tmp, where downloads land)."
        : /minimumReleaseAge|IGNORED_BUILDS/i.test(output)
          ? "A package-manager policy blocked something — see the message above."
          : undefined
    if (hint) p.log.info(hint)
    p.log.info(`Then run ${pc.cyan(pmCommands(pm).install)} inside the project.`)
    return false
  }
}

function nextSteps({
  manifest,
  answers,
  targetDir,
  pm,
  installed,
  installFailed,
}: {
  manifest: Manifest
  answers: Answers
  targetDir: string
  pm: PackageManager
  installed: boolean
  installFailed: boolean
}) {
  const run = pmCommands(pm).run
  const has = (id: string) => Object.values(answers).flat().includes(id)
  const sqlite = answers.database === "sqlite"
  const compose = has("docker") && (!sqlite || has("queues") || has("uploads"))
  const dir = relative(process.cwd(), targetDir) || "."
  const dbName = manifest.options[answers.database as string]?.label ?? "the database"

  const steps: Array<[string, string]> = []
  if (dir !== ".") steps.push([`cd ${dir}`, ""])
  if (!installed) steps.push([pmCommands(pm).install, installFailed ? "retry the install" : "install dependencies"])
  if (compose) steps.push([run("db:up"), `start ${sqlite ? "local services" : dbName} in Docker`])
  else if (!sqlite) steps.push([pc.dim("# point DATABASE_URL in .env at your database"), ""])
  steps.push([run("db:migrate"), "create the tables"])
  if (has("password")) steps.push([run("db:seed"), "add a demo admin + notes"])
  steps.push([run("dev"), "web :5173 · api :3000"])

  const width = Math.max(...steps.map(([cmd]) => cmd.length))
  const lines = steps.map(([cmd, why]) => `${accent(sym.arrow)} ${pc.bold(cmd.padEnd(width))}  ${pc.dim(why)}`)
  lines.push("")
  const extras: Array<[string, string]> = []
  if (has("password")) extras.push(["demo login", `demo@example.com ${pc.dim("/")} demo-password-123`])
  extras.push(["new feature", run("klin generate resource project name:string")])
  extras.push(["health check", run("klin doctor")])
  lines.push(...table(extras, 2))
  return box(lines, { title: installFailed ? "almost there — next steps" : `${sym.sparkle} spotless! next steps` })
}

/** Exposed for `klin doctor` / tests. */
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}
