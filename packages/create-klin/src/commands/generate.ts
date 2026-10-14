import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join, posix, relative, sep } from "node:path"
import { aboutDir, DIR_FLAGS, type Dirs, defaultDirs, LAYER_LABELS, LAYERS, type Layer, parseDir, projectDirs, withDirs } from "../generators/dirs"
import { pathsFor } from "../generators/paths"
import { type GenerateOptions, type Plan, PlanError, planGenerate, type Project, type Reader } from "../generators/plan"
import { type GenKind, KIND_LABELS, parseTarget, resolveKind, type Target, type TargetOverrides } from "../generators/target"
import { box } from "../ui/box"
import { block, centered, centeredBlock, intro, log, outro } from "../ui/log"
import * as prompts from "../ui/prompts"
import { task } from "../ui/task"
import { c, padEnd, shimmer, sym, width } from "../ui/theme"
import { fileTree } from "../ui/tree"
import { run } from "../utils/exec"
import { pmCommands, rewriteCommand } from "../utils/pm"
import { findProjectRoot, parsePackageManager, type ProjectConfig, readProject, writeProject } from "../utils/project"
import { bail, type Flags, guard } from "./flags"

const USAGE = "klin generate <resource|backend|frontend> <name>, e.g. klin generate resource blog/post"

/** The project, as every step below needs it. */
interface Session {
  root: string
  config: ProjectConfig
  project: Project
  fs: Reader
}

const OUTROS: Record<GenKind, string> = {
  resource: "Every layer wired — the fields are yours.",
  backend: "Endpoints wired — the logic is yours.",
  frontend: "Page wired — the UI is yours.",
}

/**
 * `klin generate` — asks what to make, what to call it and where it goes.
 * `klin generate <kind> <name>` — makes it straight away.
 * `klin generate paths` — shows or changes where generated files go by default.
 */
export async function generateCommand(flags: Flags) {
  const root = findProjectRoot()
  if (!root) bail("Run this inside a klin project (no klin.json found).")
  const config = readProject(root)
  const project = projectOf(config)
  const fs = diskReader(root)
  const session: Session = { root, config, project, fs }
  const interactive = Boolean(process.stdin.isTTY) && !flags.yes

  if (flags._[0] === "paths") return pathsCommand(flags, session, interactive)

  const options: GenerateOptions = {
    force: Boolean(flags.force),
    validation: flags.validation !== false,
    model: flags.model !== false,
    route: flags.route !== false,
    nav: flags.nav !== false,
    dirs: runDirs(flags, session),
  }
  const overrides: TargetOverrides = {
    plural: typeof flags.plural === "string" ? flags.plural : undefined,
    url: typeof flags.url === "string" ? flags.url : undefined,
  }

  const [rawKind, rawName, ...extra] = flags._
  if (extra.length) bail(`klin generate takes no fields any more — add them to the generated schema and model.\n  ${USAGE}`)
  let kind = rawKind ? resolveKind(rawKind) : undefined
  if (rawKind && !kind) bail(`There's no "${rawKind}" generator — pick resource, backend or frontend.\n  ${USAGE}`)
  try {
    // A bad --url or --plural fails now, not on every keystroke of the name.
    parseTarget("check", overrides)
  } catch (error) {
    bail((error as Error).message)
  }

  // The result is centered like the full-screen pages, and opens with its own
  // badge line, so the answers aren't echoed.
  const ask = interactive && (!kind || !rawName)
  if (ask) {
    prompts.setPromptEcho(false)
    // The "Where should it go?" page is the tallest; every page keeps its room.
    prompts.setPromptRoom(14)
  }
  prompts.setPromptContext(`klin generate · ${config.name}`)

  if (!kind) {
    if (!interactive) bail(`Say what to generate: ${USAGE}`)
    const choice = await askKind(project)
    if (choice === "paths") return savePaths(session, await editPaths(session, options.dirs!))
    kind = choice
  }

  let target: Target
  if (rawName) {
    try {
      target = parseTarget(rawName, overrides)
    } catch (error) {
      bail((error as Error).message)
    }
  } else {
    if (!interactive) bail(`Give it a name: klin generate ${kind} blog/post`)
    target = parseTarget(await askName(kind, project, fs, options, overrides), overrides)
  }

  let remember = false
  if (ask) ({ dirs: options.dirs, remember } = await askDirs(kind, target, session, options))

  let plan: Plan
  try {
    plan = planGenerate(kind, target, project, fs, options)
  } catch (error) {
    if (error instanceof PlanError) bail(error.message)
    throw error
  }

  /* ─── Show & write ─────────────────────────────────────────────────── */

  intro("klin generate", `${KIND_LABELS[kind]} · ${target.path} · ${config.name}`)
  centeredBlock([...fileTree(plan.edits.map(({ path, kind, note }) => ({ path, kind, note })), "").split("\n"), ""])
  for (const warning of plan.warnings) log.warn(warning)

  if (flags["dry-run"]) {
    outro(c.dim("Dry run — nothing was written."))
    return
  }
  if (remember) {
    writeProject(root, withDirs(config, project, options.dirs!))
    centered([`${c.muted(sym.info)}  These folders are this project's defaults now (klin.json).`, ""])
  }

  const writes = plan.edits.filter((edit) => edit.content !== undefined)
  await task("Writing files", async () => {
    for (const edit of writes) {
      await mkdir(dirname(join(root, edit.path)), { recursive: true })
      await writeFile(join(root, edit.path), edit.content!)
    }
  }, { done: () => `Wrote ${writes.length} files` })

  // Keep types in sync right away: the Prisma client and the router's route types
  // (TanStack's route tree, or Next.js's typed routes).
  const { pm } = project
  const prismaClient = kind === "resource" && options.model !== false
  const routeTypes = kind !== "backend" && options.route !== false && existsSync(join(root, "apps/web/node_modules"))
  const routes = project.web === "next" ? "route types" : "route tree"
  if (prismaClient || routeTypes) {
    await task(prismaClient ? "Regenerating the Prisma client and routes" : `Regenerating the ${routes}`, async () => {
      if (prismaClient) await run(pm, ["run", "db:generate"], { cwd: root })
      if (routeTypes) {
        const [bin, ...args] = pmCommands(pm).exec(project.web === "next" ? "next typegen" : "tsr generate").split(" ")
        await run(bin!, args, { cwd: join(root, "apps/web") })
      }
    }, { done: () => (prismaClient ? `Prisma client and ${routes} are up to date` : routes === "route tree" ? "Route tree is up to date" : "Route types are up to date") }).catch(() => {
      log.warn("Couldn't regenerate types automatically — they'll update on the next `dev`.")
    })
  }

  block(nextSteps(kind, target, project, config, options))
  outro(shimmer(`${sym.star} ${OUTROS[kind]}`))
}

/** What's left for the developer: the files to fill in, then how to see it run. */
function nextSteps(kind: GenKind, target: Target, project: Project, config: ProjectConfig, options: GenerateOptions) {
  const paths = pathsFor(target, options.dirs ?? defaultDirs(project), project.web)
  const backend = kind !== "frontend"
  const frontend = kind !== "backend"
  const model = kind === "resource" && options.model !== false
  const route = frontend && options.route !== false
  const todo: Array<[string, string]> = []
  if (options.validation !== false) todo.push([paths.validators, model ? "the fields clients send and get back" : "the request and response shapes"])
  if (model) todo.push([paths.prisma, "the columns"])
  if (backend && !model) todo.push([project.backend === "nest" ? paths.nest.service : paths.plain.service, "the logic"])
  if (frontend) todo.push([paths.web.form, "the inputs"])
  if (kind === "frontend") todo.push([paths.web.page, "the page"])

  const script = (name: string) => c.white(rewriteCommand(`pnpm ${name}`, project.pm))
  const steps: Array<[string, string]> = []
  if (model) steps.push([script(`db:migrate --name add-${target.one.kebab}`), "create the table"])
  steps.push([
    script("dev"),
    route ? `then open /${target.url}` : frontend ? `then show <${target.leaf.pascal}Page /> where you want it` : `then call /api/${target.url}`,
  ])

  // The box never gets wider than the terminal: a "why" that won't fit beside
  // its path or command goes under it instead.
  const maxW = Math.max(40, (process.stdout.columns || 100) - 8)
  const columns = (rows: Array<[string, string]>) => {
    const leftW = Math.max(...rows.map(([left]) => width(left)))
    return rows.every(([, why]) => leftW + 2 + width(why) <= maxW)
      ? rows.map(([left, why]) => `${padEnd(left, leftW)}  ${c.dim(why)}`)
      : rows.flatMap(([left, why]) => [left, `  ${c.dim(why)}`])
  }
  const lines = [
    c.white("fill in"),
    ...columns(todo.map(([path, why]) => [c.bright(path), why])),
    "",
    c.white("then"),
    ...columns(steps.map(([step, why]) => [`${c.dim(sym.arrow)} ${step}`, why])),
  ]
  if (kind !== "frontend") {
    lines.push("", `${c.dim("endpoints")}  GET POST /api/${target.url}`, `           GET PATCH DELETE /api/${target.url}/:id`)
  }
  const i18n = Object.values(config.answers).flat().includes("i18n")
  if (i18n && route && options.nav !== false) {
    lines.push("", `${c.dim("i18n")}  add "nav.${target.path.replaceAll("/", "-")}" to apps/web/src/i18n/locales/*.json`)
  }
  return box(lines, { title: `${sym.star} ${target.path} is wired up` })
}

/* ─── Questions ────────────────────────────────────────────────────────── */

async function askKind(project: Project): Promise<GenKind | "paths"> {
  const nest = project.backend === "nest"
  return guard(
    await prompts.select<GenKind | "paths">({
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
        {
          value: "paths",
          label: "Change default paths",
          hint: "where generated files go",
          about:
            "The folders the backend, frontend, validation and Prisma model files go in, saved in klin.json for this project. Each run can still put them somewhere else.",
        },
      ],
    })
  )
}

async function askName(kind: GenKind, project: Project, fs: Reader, options: GenerateOptions, overrides: TargetOverrides): Promise<string> {
  // Validation runs on every repaint; planning is cheap, but not free.
  const problems = new Map<string, string | undefined>()
  const problem = (value: string) => {
    if (!problems.has(value)) {
      try {
        planGenerate(kind, parseTarget(value, overrides), project, fs, options)
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
      about: `Folders nest the same way in every layer it touches, and a folder that's already there is reused — blog/post lands in ${landing(kind, project, options.dirs!, "blog/post")}. You can change where on the next page.`,
      required: "Give it a name, like post — or blog/post to put it in a blog folder",
      validate: (value) => (value.trim() ? problem(value) : undefined),
      describe: (value) => {
        if (!value.trim()) return { tone: "ok", message: "Letters, numbers and dashes; slashes make folders" }
        const target = parseTarget(value, overrides)
        const parent = target.folders.join("/")
        const reused = parent && fs.exists(posix.join(mainDir(kind, project, options.dirs!), parent))
        return { tone: "ok", message: `Goes in ${landing(kind, project, options.dirs!, target.path)}${reused ? `, inside your ${parent}/ folder` : ""}` }
      },
    })
  )
}

/** Where the main files go, short: "modules/blog/post/ and features/blog/post/". */
function landing(kind: GenKind, project: Project, dirs: Dirs, path: string) {
  const under = (dir: string, rest: string) => [dir.replace(/^apps\/(api|web)\/src\/?/, ""), rest].filter(Boolean).join("/")
  const api = project.backend === "nest" ? under(dirs.backend, `${path}/`) : under(dirs.backend, `routes/${path}.ts`)
  const web = under(dirs.frontend, `${path}/`)
  return kind === "resource" ? `${api} and ${web}` : kind === "backend" ? api : web
}

function mainDir(kind: GenKind, project: Project, dirs: Dirs) {
  if (kind === "frontend") return dirs.frontend
  return project.backend === "nest" ? dirs.backend : `${dirs.backend}/routes`
}

/** Whether a kind (with its flags) writes anything in a layer. */
function usesLayer(kind: GenKind, layer: Layer, options: GenerateOptions) {
  if (layer === "backend") return kind !== "frontend"
  if (layer === "frontend") return kind !== "backend"
  if (layer === "validation") return options.validation !== false
  return kind === "resource" && options.model !== false
}

/** The error message of `fn`, or undefined when it doesn't throw. */
function problemOf(fn: () => unknown) {
  try {
    fn()
    return undefined
  } catch (error) {
    return (error as Error).message
  }
}

/** "Where should it go?" — this run's folders, prefilled; Enter keeps them. */
async function askDirs(kind: GenKind, target: Target, session: Session, options: GenerateOptions): Promise<{ dirs: Dirs; remember: boolean }> {
  const { project, fs } = session
  const dirs = options.dirs!
  const builtIn = defaultDirs(project)
  const entity = [...target.folders, target.one.kebab].join("/")
  const lands: Record<Layer, (dir: string) => string> = {
    backend: (dir) => (project.backend === "nest" ? `${dir}/${target.path}/` : `${dir}/routes/${target.path}.ts`),
    frontend: (dir) => `${dir}/${target.path}/`,
    validation: (dir) => `${dir}/${entity}.ts`,
    model: (dir) => `${dir}/${entity}.prisma`,
  }
  const chosen = (values: Record<string, string>): Dirs => {
    const next = { ...dirs }
    for (const [layer, value] of Object.entries(values)) next[layer as Layer] = parseDir(layer as Layer, value, fs, project.web)
    return next
  }
  const result = guard(
    await prompts.inputs({
      message: "Where should it go?",
      subtitle: "A folder for each layer — Enter keeps them, tab moves between them.",
      inputs: LAYERS.filter((layer) => usesLayer(kind, layer, options)).map((layer) => ({
        id: layer,
        label: LAYER_LABELS[layer],
        value: dirs[layer],
        placeholder: builtIn[layer],
        about: aboutDir(layer, project),
        validate: (value) => problemOf(() => parseDir(layer, value, fs, project.web)),
        describe: (value) => lands[layer](parseDir(layer, value, fs, project.web)),
      })),
      toggleTitle: "Defaults",
      toggles: [
        {
          value: "remember",
          label: "Use these from now on",
          about: "Saves the folders to klin.json as this project's defaults. Change them again with klin generate paths.",
        },
      ],
      // Somewhere else, the files may already exist (or names may clash).
      check: (values) => problemOf(() => planGenerate(kind, target, project, fs, { ...options, dirs: chosen(values) })),
    })
  )
  return { dirs: chosen(result.values), remember: result.toggles.includes("remember") }
}

/* ─── Default paths ────────────────────────────────────────────────────── */

/** The project's folders with this run's --backend-dir & co. on top. */
function runDirs(flags: Flags, { config, project, fs }: Session): Dirs {
  let dirs: Dirs
  try {
    dirs = projectDirs(config, project, fs)
  } catch (error) {
    bail((error as Error).message)
  }
  return { ...dirs, ...dirFlags(flags, { project, fs }) }
}

/** --backend-dir & co., each checked — a bad folder fails before any question is asked. */
function dirFlags(flags: Flags, { project, fs }: Pick<Session, "project" | "fs">): Partial<Dirs> {
  const given: Partial<Dirs> = {}
  for (const layer of LAYERS) {
    const raw = flags[DIR_FLAGS[layer]]
    if (raw === undefined) continue
    try {
      if (typeof raw !== "string") throw new Error("give it once, with one folder")
      given[layer] = parseDir(layer, raw, fs, project.web)
    } catch (error) {
      bail(`--${DIR_FLAGS[layer]}: ${(error as Error).message}`)
    }
  }
  return given
}

/**
 * `klin generate paths` — the project's default folders. With --…-dir flags
 * it sets them, with --reset it goes back to klin's, in a terminal it opens
 * them for editing, and otherwise it lists them.
 */
async function pathsCommand(flags: Flags, session: Session, interactive: boolean) {
  const { config, project, fs } = session
  if (flags._.length > 1) bail(`klin generate paths takes no name — set folders with ${LAYERS.map((layer) => `--${DIR_FLAGS[layer]}`).join(", ")}`)
  const given = dirFlags(flags, session)
  const setting = Object.keys(given).length > 0
  if (flags.reset && setting) bail("--reset puts every folder back to klin's default — leave the --…-dir flags out")

  const ask = interactive && !flags.reset && !setting
  if (ask) prompts.setPromptEcho(false)
  prompts.setPromptContext(`klin generate · ${config.name}`)

  if (flags.reset) return savePaths(session, defaultDirs(project), "Back to klin's default paths")
  const current = runDirs({ _: [] }, session)
  if (setting) return savePaths(session, { ...current, ...given })
  if (ask) return savePaths(session, await editPaths(session, current))
  intro("klin generate", `Default paths · ${config.name}`)
  centeredBlock([...dirsTable(current, project), ""])
  outro(`Change one: ${c.code("klin generate paths --frontend-dir <folder>")} ${c.dim("·")} ${c.code("--reset")} ${c.dim("for klin's")}`)
}

/** The page behind `klin generate paths`: every layer's default folder. */
async function editPaths({ project, fs }: Session, current: Dirs): Promise<Dirs> {
  const builtIn = defaultDirs(project)
  const result = guard(
    await prompts.inputs({
      message: "Where should generated files go?",
      subtitle: "This project's defaults, saved in klin.json. Leave one empty for klin's own.",
      inputs: LAYERS.map((layer) => ({
        id: layer,
        label: LAYER_LABELS[layer],
        value: current[layer],
        placeholder: builtIn[layer],
        about: aboutDir(layer, project),
        validate: (value) => problemOf(() => parseDir(layer, value, fs, project.web)),
        describe: (value) => (parseDir(layer, value, fs, project.web) === builtIn[layer] ? "klin's default" : "this project's own"),
      })),
    })
  )
  const dirs = { ...current }
  for (const layer of LAYERS) dirs[layer] = parseDir(layer, result.values[layer]!, fs, project.web)
  return dirs
}

/** Writes the folders to klin.json and shows them. */
function savePaths({ root, config, project }: Session, dirs: Dirs, message = "Default paths saved in klin.json") {
  writeProject(root, withDirs(config, project, dirs))
  intro("klin generate", `${message} · ${config.name}`)
  centeredBlock([...dirsTable(dirs, project), ""])
  outro(shimmer(`${sym.star} Generated files go here from now on.`))
}

/** `Backend        apps/api/src/modules   klin's default` — one row per layer. */
function dirsTable(dirs: Dirs, project: Project) {
  const builtIn = defaultDirs(project)
  const labelW = Math.max(...LAYERS.map((layer) => width(LAYER_LABELS[layer])))
  const dirW = Math.max(...LAYERS.map((layer) => width(dirs[layer])))
  return LAYERS.map(
    (layer) => `${c.dim(padEnd(LAYER_LABELS[layer], labelW))}  ${c.bright(padEnd(dirs[layer], dirW))}  ${c.faint(dirs[layer] === builtIn[layer] ? "klin's default" : "this project's")}`
  )
}

/* ─── The project ──────────────────────────────────────────────────────── */

function projectOf(config: ProjectConfig): Project {
  const enabled = new Set(Object.values(config.answers).flat())
  return {
    // Projects from before the backend choice are NestJS on Express.
    backend: config.answers.backend === "plain" ? "plain" : "nest",
    server: config.answers.server === "fastify" ? "fastify" : "express",
    // Projects from before the web choice run on Vite.
    web: config.answers.web === "next" ? "next" : "vite",
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
