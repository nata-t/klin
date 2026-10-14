import { existsSync, readFileSync } from "node:fs"
import { rm, writeFile } from "node:fs/promises"
import { basename, join, relative, resolve } from "node:path"
import { cliDependency, resolveTemplate, VERSION } from "../context"
import {
  type Answers,
  loadManifest,
  type Manifest,
  normalizeAnswers,
  PACKAGE_MANAGERS,
  type PackageManager,
  stepsFor,
} from "../engine/manifest"
import { render } from "../engine/render"
import { banner } from "../ui/banner"
import { box, table } from "../ui/box"
import { block, cancel, centered, centeredBlock, intro, log, outro } from "../ui/log"
import { isCancel } from "../ui/prompts"
import { INSTALL_QUIPS, setTaskReporter, task } from "../ui/task"
import { interactive } from "../ui/term"
import { c, padEnd, pick, shimmer, swatch, sym, width } from "../ui/theme"
import { fileTree } from "../ui/tree"
import { type DockerState, dockerFix, dockerState } from "../utils/docker"
import { generateEnv } from "../utils/env-file"
import { run } from "../utils/exec"
import { isEmptyDir, writeFileMap } from "../utils/fs"
import { isValidPackageName, toSlug } from "../utils/names"
import { detectInvokingPm, FALLBACK_PM_VERSIONS, pmCommands, pmVersion } from "../utils/pm"
import { PROJECT_FILE, projectFileContent, type ProjectConfig } from "../utils/project"
import type { Flags } from "./flags"
import { answersFromFlags, bail } from "./flags"
import { buildProgress, wizard } from "./wizard"

const SIGN_OFFS = [
  "Go build something lovely.",
  "Now go make a mess — we'll help tidy up.",
  "Fresh sheets, clean slate. Have fun!",
  "Everything's in its place. Your move.",
  "Spotless. Ship something great.",
]

export async function create(flags: Flags) {
  const template = resolveTemplate(flags.template)
  const manifest = loadManifest(template.dir)
  const ask = interactive && !flags.yes
  const cwd = flags.cwd ?? process.cwd()

  /* ─── Answers: flags & preset first, then the wizard ───────────────── */
  const fromFlags = answersFromFlags(manifest, flags)
  const presetId = flags.preset ?? "recommended"
  let input: Answers = { ...presetAnswers(manifest, presetId), ...fromFlags }

  let name = flags._[0] && flags._[0] !== "create" && flags._[0] !== "new" ? flags._[0] : flags._[1]
  let pm = choosePackageManager(flags)
  let wipe = Boolean(flags.force)

  if (ask) {
    const pmVersions = Object.fromEntries(PACKAGE_MANAGERS.map((p) => [p, pmVersion(p)])) as Record<PackageManager, string | null>
    if (!flags.pm && !pmVersions[pm]) pm = PACKAGE_MANAGERS.find((p) => pmVersions[p]) ?? pm
    const result = await wizard({
      manifest,
      cwd,
      name,
      pm,
      pmVersions,
      preset: presetId,
      answers: normalizeAnswers(manifest, input).answers,
      force: Boolean(flags.force),
      install: flags.install !== false,
      git: flags.git !== false,
    })
    if (isCancel(result)) {
      cancel("Swept under the rug — nothing changed.")
      process.exit(0)
    }
    name = result.name
    pm = result.pm
    input = result.answers
    wipe = wipe || result.wipe
  } else if (flags.banner !== false) {
    await banner(VERSION)
  }

  name ||= "my-klin-app"
  const targetDir = resolve(cwd, name)
  const projectName = toSlug(basename(targetDir))
  if (!projectName || !isValidPackageName(projectName)) bail(`"${name}" isn't a valid project name`)
  if (!isEmptyDir(targetDir) && !wipe) bail(`${targetDir} isn't empty — use --force to overwrite it`)

  let normalized
  try {
    normalized = normalizeAnswers(manifest, input)
  } catch (error) {
    bail((error as Error).message)
  }
  const { answers, notes } = normalized
  const version = pmVersion(pm) ?? FALLBACK_PM_VERSIONS[pm]

  if (!ask) {
    intro("create-klin", "let's set up your project")
    block(recipe(manifest, answers, projectName, pm, version))
    for (const note of notes) log.info(note)
  }

  /* ─── Build ────────────────────────────────────────────────────────── */
  const dir = relative(process.cwd(), targetDir) || "."
  const willInstall = flags.install !== false
  const git = flags.git !== false && !flags["dry-run"] && (await gitAvailable(targetDir))
  const progress =
    ask && !flags["dry-run"]
      ? buildProgress({
          heading: "Snapping it together.",
          subtitle: `./${dir} · ${pm}`,
          labels: ["Base", ...stepsFor(manifest).map((step) => step.title), "Build"],
          plan: [
            "Sweeping the template",
            "Laying everything out",
            ...(git ? ["Initializing git"] : []),
            ...(willInstall ? [`Installing dependencies with ${pm}`, "Generating the Prisma client"] : []),
            ...(git ? ["Making the first commit"] : []),
          ],
        })
      : undefined
  setTaskReporter(progress?.reporter)

  let installed = false
  try {
    const files = await task(
      "Sweeping the template",
      () => render({ templateDir: template.dir, manifest, answers, pm, pmVersion: version, name: projectName, cliDependency: cliDependency() }),
      { done: (f) => `Swept ${f.size} files into shape` }
    )

    const config: ProjectConfig = {
      version: VERSION,
      template: template.source,
      name: projectName,
      packageManager: `${pm}@${version}`,
      answers,
    }

    if (flags["dry-run"]) {
      log.step(`Dry run — this is what ${c.white(projectName)} would contain:`)
      centeredBlock([...fileTree([...files.keys(), PROJECT_FILE, ".env"].map((path) => ({ path, kind: "create" as const })), "").split("\n"), ""])
      outro(c.dim("Nothing was written."))
      return
    }

    if (wipe && existsSync(targetDir)) await rm(targetDir, { recursive: true, force: true })

    await task(
      "Laying everything out",
      async () => {
        await writeFileMap(targetDir, files)
        await writeFile(join(targetDir, PROJECT_FILE), projectFileContent(config))
        const example = files.get(".env.example")?.content.toString()
        if (example) await writeFile(join(targetDir, ".env"), generateEnv(example, manifest.env?.generate ?? {}))
      },
      { done: () => `Wrote ./${dir} with a fresh .env (new secrets, just for you)` }
    )

    if (git) {
      await task(
        "Initializing git",
        async () => {
          const result = await run("git", ["init", "-b", "main"], { cwd: targetDir })
          if (result.code !== 0) await run("git", ["init"], { cwd: targetDir })
        },
        { done: () => "Initialized a git repository" }
      )
    }

    if (willInstall) {
      installed = await installDependencies(targetDir, pm, () => progress?.stop())
      if (installed) {
        await task(
          "Generating the Prisma client",
          async () => {
            const result = await run(pm, ["run", "db:generate"], { cwd: targetDir })
            if (result.code !== 0) throw new Error(result.output)
          },
          { done: () => "Generated the Prisma client" }
        ).catch(() => {
          progress?.stop()
          log.warn(`Couldn't run prisma generate — run ${c.code(pmCommands(pm).run("db:generate"))} yourself.`)
        })
      } else progress?.skip("Generating the Prisma client")
    }

    if (git) {
      await task(
        "Making the first commit",
        async () => {
          await run("git", ["add", "-A"], { cwd: targetDir })
          const result = await run("git", ["commit", "--no-verify", "-m", "chore: initial commit from create-klin"], { cwd: targetDir })
          if (result.code !== 0) throw new Error("commit failed")
        },
        { done: () => "Committed the initial state" }
      ).catch(() => {
        progress?.stop()
        log.info(c.dim("Skipped the initial commit (is git user.name/email set?)"))
      })
    }
  } finally {
    progress?.stop()
    setTaskReporter(undefined)
  }

  /* ─── Next steps ───────────────────────────────────────────────────── */
  const installFailed = willInstall && !installed
  // db:up needs Docker: if this user can't reach it yet, the steps say how to fix that first.
  const docker = usesCompose(answers) ? await dockerState() : "ready"
  const steps = nextSteps({ manifest, answers, targetDir, pm, installed, installFailed, docker })
  const optionNotes = Object.values(answers)
    .flat()
    .map((id) => manifest.options[id]?.note)
    .filter(Boolean) as string[]
  const signOff = installFailed ? c.warn("Almost there — rerun the install once the problem above is fixed.") : shimmer(`${sym.star} ${pick(SIGN_OFFS)}`)

  // The last word, centered like the wizard's pages.
  centered(["", `${c.badge("create-klin")}  ${c.muted(`${projectName} is ready`)}`])
  block(steps)
  outro(signOff, optionNotes)
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function presetAnswers(manifest: Manifest, id: string): Answers {
  const preset = manifest.presets?.[id]
  if (!preset) bail(`Unknown preset "${id}". Try: ${Object.keys(manifest.presets ?? {}).join(", ")}`)
  return { ...preset.answers }
}

function choosePackageManager(flags: Flags): PackageManager {
  if (flags.pm) {
    if (!PACKAGE_MANAGERS.includes(flags.pm as PackageManager)) bail(`--pm must be one of ${PACKAGE_MANAGERS.join(", ")}`)
    return flags.pm as PackageManager
  }
  // `pnpm create klin` / `bun create klin` say what you use; anything else
  // (npm create, npx, the bare binary) gets the default: bun, if it's installed.
  const invoking = detectInvokingPm()
  if (invoking === "pnpm" || invoking === "bun") return invoking
  return PACKAGE_MANAGERS.find((pm) => pmVersion(pm)) ?? "npm"
}

function optionLabels(manifest: Manifest, ids: string[] | string | undefined) {
  const list = (Array.isArray(ids) ? ids : ids ? [ids] : []).map((id) => manifest.options[id]?.label ?? id)
  return list.length ? list.join(", ") : c.dim("none")
}

function recipe(manifest: Manifest, answers: Answers, name: string, pm: PackageManager, version: string) {
  const rows: Array<[string, string]> = [["name", c.white(name)]]
  for (const question of manifest.questions) {
    const value = answers[question.id]
    const text =
      question.id === "accent"
        ? `${swatch(manifest.options[value as string]?.swatch)} ${optionLabels(manifest, value)}`
        : optionLabels(manifest, value)
    rows.push([(question.title ?? question.id).toLowerCase(), text])
  }
  rows.push(["tooling", `${pm} ${c.dim(`v${version}`)}`])
  return box(table(rows), { title: "your recipe" })
}

async function gitAvailable(dir: string) {
  const version = await run("git", ["--version"], { cwd: process.cwd() })
  if (version.code !== 0) return false
  // Don't nest a repo inside another one (e.g. scaffolding inside a monorepo).
  const inside = await run("git", ["rev-parse", "--is-inside-work-tree"], { cwd: resolve(dir, "..") })
  return inside.code !== 0
}

async function installDependencies(dir: string, pm: PackageManager, leaveScreen: () => void) {
  if (!pmVersion(pm)) {
    leaveScreen()
    log.warn(`${pm} isn't installed, so dependencies weren't installed. Install ${pm} and run ${c.code(pmCommands(pm).install)}.`)
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
    leaveScreen()
    const output = (error as { output?: string }).output ?? String(error)
    log.error(`${pm} install hit a snag. Last lines:\n${c.dim(output.split("\n").slice(-15).join("\n"))}`)
    const hint = /ENOSPC|no space left/i.test(output)
      ? "The disk (or /tmp) is full — free some space."
      : /ENOTFOUND|ETIMEDOUT|ECONNRESET|EAI_AGAIN|failed to resolve|network/i.test(output)
        ? "Looks like a network or registry problem — check your connection (or free space in /tmp, where downloads land)."
        : /minimumReleaseAge|IGNORED_BUILDS/i.test(output)
          ? "A package-manager policy blocked something — see the message above."
          : /ERESOLVE/i.test(output)
            ? "npm couldn't settle a peer dependency — see the message above."
            : undefined
    if (hint) log.info(hint)
    log.info(`Then run ${c.code(pmCommands(pm).install)} inside the project.`)
    return false
  }
}

/** Whether the project runs local services (database, Redis, storage) with Docker Compose. */
function usesCompose(answers: Answers) {
  const has = (id: string) => Object.values(answers).flat().includes(id)
  return has("docker") && (answers.database !== "sqlite" || has("queues") || has("uploads"))
}

function nextSteps({
  manifest,
  answers,
  targetDir,
  pm,
  installed,
  installFailed,
  docker,
}: {
  manifest: Manifest
  answers: Answers
  targetDir: string
  pm: PackageManager
  installed: boolean
  installFailed: boolean
  docker: DockerState
}) {
  const run = pmCommands(pm).run
  const has = (id: string) => Object.values(answers).flat().includes(id)
  const sqlite = answers.database === "sqlite"
  const dir = relative(process.cwd(), targetDir) || "."
  const dbName = manifest.options[answers.database as string]?.label ?? "the database"

  const steps: Step[] = []
  if (dir !== ".") steps.push([`cd ${dir}`, ""])
  if (!installed) steps.push([pmCommands(pm).install, installFailed ? "retry the install" : "install dependencies"])
  if (usesCompose(answers)) {
    if (docker !== "ready") for (const [command, why] of dockerFix(docker).steps) steps.push([command, why, true])
    steps.push([run("db:up"), `start ${sqlite ? "local services" : dbName} in Docker`])
  } else if (!sqlite) steps.push(["# point DATABASE_URL in .env at your database", ""])
  steps.push([run("db:migrate"), "create the tables"])
  if (has("password")) steps.push([run("db:seed"), "add a demo admin + notes"])
  steps.push([run("dev"), "web :5173 · api :3000 · studio :5555"])

  // The box never gets wider than the terminal: explanations move under their
  // command when they don't fit beside it.
  const maxW = Math.max(40, Math.min(76, (process.stdout.columns || 100) - 8))
  const lines = [c.white("run it")]
  if (docker !== "ready" && usesCompose(answers)) lines.push(c.warn(`${sym.warn} ${dockerFix(docker).problem} — fix it first`))
  lines.push(...commandLines(steps, maxW))

  lines.push("")
  const extras: Array<[string, string]> = []
  if (has("password")) extras.push(["demo login", `demo@example.com ${c.dim("/")} demo-password-123`])
  extras.push(["new feature", run("klin generate")])
  extras.push(["add a component", run("ui:add dialog")])
  extras.push(["health check", run("klin doctor")])
  // Same rule as the commands: a value that won't fit beside its label goes under it.
  const labelW = Math.max(...extras.map(([label]) => width(label)))
  if (extras.every(([, value]) => labelW + 2 + width(value) <= maxW)) lines.push(...table(extras, 2))
  else lines.push(...extras.flatMap(([label, value]) => [c.dim(label), `  ${value}`]))
  return box(lines, { title: installFailed ? "almost there — next steps" : "spotless! next steps" })
}

/** A command, why you'd run it, and whether it's a fix to make first (drawn in amber). */
type Step = [command: string, why: string, fix?: boolean]

/** `→ command  why`, aligned — or the why on its own line when it won't fit. */
function commandLines(rows: Step[], maxW: number): string[] {
  const cmdW = Math.max(...rows.map(([cmd]) => width(cmd)))
  const inline = rows.every(([, why]) => !why || 2 + cmdW + 2 + width(why) <= maxW)
  return rows.flatMap(([cmd, why, fix]) => {
    const arrow = fix ? c.warn(sym.arrow) : c.dim(sym.arrow)
    const command = cmd.startsWith("#") ? c.dim(cmd) : c.white(cmd)
    if (!why) return [`${arrow} ${command}`]
    if (inline) return [`${arrow} ${padEnd(command, cmdW)}  ${c.dim(why)}`]
    return [`${arrow} ${command}`, `    ${c.dim(why)}`]
  })
}

/** Exposed for `klin doctor` / tests. */
export function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T
}
