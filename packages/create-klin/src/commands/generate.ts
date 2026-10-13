import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, posix, relative, sep } from "node:path"
import { pathsFor } from "../generators/paths"
import { type Plan, PlanError, planGenerate, type Project, type Reader } from "../generators/plan"
import { type GenKind, KIND_LABELS, parseTarget, resolveKind, type Target } from "../generators/target"
import { box } from "../ui/box"
import { intro, log, outro } from "../ui/log"
import * as prompts from "../ui/prompts"
import { task } from "../ui/task"
import { c, padEnd, shimmer, sym, width } from "../ui/theme"
import { fileTree } from "../ui/tree"
import { run } from "../utils/exec"
import { pmCommands, rewriteCommand } from "../utils/pm"
import { findProjectRoot, parsePackageManager, type ProjectConfig, readProject } from "../utils/project"
import { bail, type Flags, guard } from "./flags"

const USAGE = "klin generate <resource|backend|frontend> <name>, e.g. klin generate resource blog/post"

const OUTROS: Record<GenKind, string> = {
  resource: "Every layer wired — the fields are yours.",
  backend: "Endpoints wired — the logic is yours.",
  frontend: "Page wired — the UI is yours.",
}

/**
 * `klin generate` — asks what to make and what to call it.
 * `klin generate <kind> <name>` — makes it straight away.
 */
export async function generateCommand(flags: Flags) {
  const root = findProjectRoot()
  if (!root) bail("Run this inside a klin project (no klin.json found).")
  const config = readProject(root)
  const project = projectOf(config)
  const fs = diskReader(root)
  const interactive = Boolean(process.stdin.isTTY) && !flags.yes
  const force = Boolean(flags.force)

  const [rawKind, rawName, ...extra] = flags._
  if (extra.length) bail(`klin generate takes no fields any more — add them to the generated schema and model.\n  ${USAGE}`)
  let kind = rawKind ? resolveKind(rawKind) : undefined
  if (rawKind && !kind) bail(`There's no "${rawKind}" generator — pick resource, backend or frontend.\n  ${USAGE}`)

  intro("klin generate", c.dim(config.name))
  prompts.setPromptContext(`klin generate · ${config.name}`)

  if (!kind) {
    if (!interactive) bail(`Say what to generate: ${USAGE}`)
    kind = await askKind(project)
  }

  let target: Target
  if (rawName) {
    try {
      target = parseTarget(rawName)
    } catch (error) {
      bail((error as Error).message)
    }
  } else {
    if (!interactive) bail(`Give it a name: klin generate ${kind} blog/post`)
    target = parseTarget(await askName(kind, project, fs, force))
  }

  let plan: Plan
  try {
    plan = planGenerate(kind, target, project, fs, { force })
  } catch (error) {
    if (error instanceof PlanError) bail(error.message)
    throw error
  }

  /* ─── Show & write ─────────────────────────────────────────────────── */

  log.step(`${KIND_LABELS[kind]} ${c.bold(target.path)}`)
  console.log(fileTree(plan.edits.map(({ path, kind, note }) => ({ path, kind, note }))))
  console.log()
  for (const warning of plan.warnings) log.warn(warning)

  if (flags["dry-run"]) {
    outro(c.dim("Dry run — nothing was written."))
    return
  }

  const writes = plan.edits.filter((edit) => edit.content !== undefined)
  await task("Writing files", async () => {
    for (const edit of writes) {
      await mkdir(dirname(join(root, edit.path)), { recursive: true })
      await writeFile(join(root, edit.path), edit.content!)
    }
  }, { done: () => `Wrote ${writes.length} files` })

  // Keep types in sync right away: the Prisma client and TanStack's route tree.
  const { pm } = project
  const prismaClient = kind === "resource"
  const routeTree = kind !== "backend" && existsSync(join(root, "apps/web/node_modules"))
  if (prismaClient || routeTree) {
    await task(prismaClient ? "Regenerating the Prisma client and routes" : "Regenerating the route tree", async () => {
      if (prismaClient) await run(pm, ["run", "db:generate"], { cwd: root })
      if (routeTree) {
        const [bin, ...args] = pmCommands(pm).exec("tsr generate").split(" ")
        await run(bin!, args, { cwd: join(root, "apps/web") })
      }
    }, { done: () => (prismaClient ? "Prisma client and route tree are up to date" : "Route tree is up to date") }).catch(() => {
      log.warn("Couldn't regenerate types automatically — they'll update on the next `dev`.")
    })
  }

  console.log(nextSteps(kind, target, project, config))
  outro(shimmer(OUTROS[kind]))
}

/** What's left for the developer: the files to fill in, then how to see it run. */
function nextSteps(kind: GenKind, target: Target, project: Project, config: ProjectConfig) {
  const paths = pathsFor(target)
  const service = project.backend === "nest" ? paths.nest.service : paths.plain.service
  const todo: Array<[string, string]> =
    kind === "resource"
      ? [
          [paths.validators, "the fields clients send and get back"],
          [paths.prisma, "the columns"],
          [paths.web.form, "the inputs"],
        ]
      : kind === "backend"
        ? [
            [service, "the logic"],
            [paths.validators, "the request and response shapes"],
          ]
        : [
            [paths.validators, "the request and response shapes"],
            [paths.web.form, "the inputs"],
            [paths.web.page, "the page"],
          ]
  const script = (name: string) => c.white(rewriteCommand(`pnpm ${name}`, project.pm))
  const steps: Array<[string, string]> = []
  if (kind === "resource") steps.push([script(`db:migrate --name add-${target.one.kebab}`), "create the table"])
  steps.push([script("dev"), kind === "backend" ? `then call /api/${target.path}` : `then open /${target.path}`])

  const pathW = Math.max(...todo.map(([path]) => width(path)))
  const stepW = Math.max(...steps.map(([step]) => width(step)))
  const lines = [
    c.white("fill in"),
    ...todo.map(([path, why]) => `${c.bright(padEnd(path, pathW))}  ${c.dim(why)}`),
    "",
    c.white("then"),
    ...steps.map(([step, why]) => `${c.dim(sym.arrow)} ${padEnd(step, stepW)}  ${c.dim(why)}`),
  ]
  if (kind !== "frontend") {
    lines.push("", `${c.dim("endpoints")}  GET POST /api/${target.path}`, `           GET PATCH DELETE /api/${target.path}/:id`)
  }
  const i18n = Object.values(config.answers).flat().includes("i18n")
  if (i18n && kind !== "backend") {
    lines.push("", `${c.dim("i18n")}  add "nav.${target.path.replaceAll("/", "-")}" to apps/web/src/i18n/locales/*.json`)
  }
  return box(lines, { title: `${sym.star} ${target.path} is wired up` })
}

/* ─── Questions ────────────────────────────────────────────────────────── */

async function askKind(project: Project): Promise<GenKind> {
  const nest = project.backend === "nest"
  return guard(
    await prompts.select<GenKind>({
      message: "What should klin generate?",
      subtitle: "The files and the wiring — the fields and the logic stay yours.",
      title: "Generators",
      options: [
        {
          value: "resource",
          label: KIND_LABELS.resource,
          hint: "model · schemas · API · page",
          about:
            "A Prisma model, its Zod schemas in packages/validators, an API with the five REST endpoints and a web page with query hooks and a form — wired end to end. You add the fields.",
        },
        {
          value: "backend",
          label: KIND_LABELS.backend,
          hint: nest ? "controller · service · DTOs · module" : "routes · service",
          about: nest
            ? "A controller with the five REST endpoints, a service to fill in, nestjs-zod DTOs and a module registered in app.module.ts — plus its schemas in packages/validators."
            : "Routes for the five REST endpoints, mounted in app.ts, and a service to fill in — plus its schemas in packages/validators.",
        },
        {
          value: "frontend",
          label: KIND_LABELS.frontend,
          hint: "page · route · hooks · form",
          about:
            "A page and its route, TanStack Query hooks for the API, a form and a sidebar entry in apps/web — plus its schemas in packages/validators.",
        },
      ],
    })
  )
}

async function askName(kind: GenKind, project: Project, fs: Reader, force: boolean): Promise<string> {
  // Validation runs on every repaint; planning is cheap, but not free.
  const problems = new Map<string, string | undefined>()
  const problem = (value: string) => {
    if (!problems.has(value)) {
      try {
        planGenerate(kind, parseTarget(value), project, fs, { force })
        problems.set(value, undefined)
      } catch (error) {
        // One line under the input: drop the path prefixes everyone knows.
        const message = (error as Error).message
        problems.set(value, message.replace(/(apps\/(api|web)\/src|packages)\//g, "").replace("use --force to overwrite it", "pick another name"))
      }
    }
    return problems.get(value)
  }
  const label = KIND_LABELS[kind].toLowerCase()
  return guard(
    await prompts.text({
      message: `Name the ${label}`,
      subtitle: "Slashes file it in folders: blog/post goes in a blog folder.",
      label: "Name",
      hint: "singular or plural",
      placeholder: "blog/post",
      about: `Folders nest the same way in every layer it touches, and a folder that's already there is reused — blog/post lands in ${landing(kind, project).replaceAll("<path>", "blog/post")}.`,
      required: "Give it a name, like post — or blog/post to put it in a blog folder",
      validate: (value) => (value.trim() ? problem(value) : undefined),
      describe: (value) => {
        if (!value.trim()) return { tone: "ok", message: "Letters, numbers and dashes; slashes make folders" }
        const target = parseTarget(value)
        const parent = target.folders.join("/")
        const reused = parent && fs.exists(posix.join(mainDir(kind, project), parent))
        return { tone: "ok", message: `Goes in ${landing(kind, project).replaceAll("<path>", target.path)}${reused ? `, inside your ${parent}/ folder` : ""}` }
      },
    })
  )
}

/** Where the main files go, with <path> for the name: "modules/<path>/ and features/<path>/". */
function landing(kind: GenKind, project: Project) {
  const api = project.backend === "nest" ? "modules/<path>/" : "routes/<path>.ts"
  return kind === "resource" ? `${api} and features/<path>/` : kind === "backend" ? api : "features/<path>/"
}

function mainDir(kind: GenKind, project: Project) {
  if (kind === "frontend") return "apps/web/src/features"
  return project.backend === "nest" ? "apps/api/src/modules" : "apps/api/src/routes"
}

/* ─── The project ──────────────────────────────────────────────────────── */

function projectOf(config: ProjectConfig): Project {
  const enabled = new Set(Object.values(config.answers).flat())
  return {
    // Projects from before the backend choice are NestJS on Express.
    backend: config.answers.backend === "plain" ? "plain" : "nest",
    server: config.answers.server === "fastify" ? "fastify" : "express",
    packagesUi: enabled.has("packages-ui"),
    pm: parsePackageManager(config.packageManager).pm,
  }
}

function diskReader(root: string): Reader {
  const abs = (path: string) => join(root, path)
  return {
    read: (path) => (existsSync(abs(path)) && statSync(abs(path)).isFile() ? readFileSync(abs(path), "utf8") : null),
    exists: (path) => existsSync(abs(path)),
    files: (dir) =>
      existsSync(abs(dir))
        ? readdirSync(abs(dir), { recursive: true, withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"))
        : [],
  }
}
