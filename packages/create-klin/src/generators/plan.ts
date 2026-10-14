import type { PackageManager } from "../engine/manifest"
import type { ChangeKind } from "../ui/tree"
import { rewriteCommand } from "../utils/pm"
import { type Dirs, defaultDirs } from "./dirs"
import { importPath, pathsFor, type TemplateContext } from "./paths"
import { commandFor, type GenKind, type Target } from "./target"
import * as api from "./templates/api"
import { prismaFile, schemaExports, schemaImports, validatorsFile } from "./templates/schema"
import * as web from "./templates/web"

/** What generation needs to know about the project (from klin.json). */
export interface Project {
  backend: "nest" | "plain"
  server: "express" | "fastify"
  /** shadcn components live in packages/ui (`@repo/ui/components/*`). */
  packagesUi: boolean
  pm: PackageManager
}

/** Read access to the project, relative to its root — the disk, or a rendered template in tests. */
export interface Reader {
  read(path: string): string | null
  exists(path: string): boolean
  /** Every file under `dir`, recursively, as root-relative paths. */
  files(dir: string): string[]
}

export interface Edit {
  path: string
  kind: ChangeKind
  /** Absent for files that are kept as they are. */
  content?: string
  note?: string
}

export interface Plan {
  edits: Edit[]
  warnings: string[]
}

/** A problem with the request itself (taken name, existing files) — shown as-is. */
export class PlanError extends Error {}

/** The --flags: everything is on unless switched off. --url and --plural live on the Target. */
export interface GenerateOptions {
  /** Overwrite generated files that already exist (never the shared schema file). */
  force?: boolean
  /** Write the schema file in packages/validators (`--no-validation`). */
  validation?: boolean
  /** Write the Prisma model of a resource (`--no-model`). */
  model?: boolean
  /** Write the page's route file (`--no-route`); without one there's no nav entry either. */
  route?: boolean
  /** Add a sidebar entry (`--no-nav`). */
  nav?: boolean
  /** The layer folders, already checked with parseDir — klin's defaults when left out. */
  dirs?: Dirs
}

/**
 * Every file `klin generate <kind> <path>` writes or touches. Nothing is
 * written here; a clash anywhere throws a PlanError before any file changes.
 */
export function planGenerate(kind: GenKind, target: Target, project: Project, fs: Reader, options: GenerateOptions = {}): Plan {
  const backend = kind !== "frontend"
  const frontend = kind !== "backend"
  const model = kind === "resource" && options.model !== false
  const route = frontend && options.route !== false
  const nav = route && options.nav !== false
  const paths = pathsFor(target, options.dirs ?? defaultDirs(project))
  const ctx: TemplateContext = { target, kind, paths, command: commandFor(kind, target), withModel: model }
  const edits: Edit[] = []
  const warnings: string[] = []

  if (kind !== "resource" && options.model === false) warnings.push("--no-model does nothing here — only a full-stack resource writes a model")
  if (!frontend && options.route === false) warnings.push("--no-route does nothing here — a backend module has no page")
  if (!frontend && options.nav === false) warnings.push("--no-nav does nothing here — a backend module has no page")

  const current = (path: string) => edits.findLast((e) => e.path === path)?.content ?? fs.read(path)

  const write = (path: string, content: string) => {
    const exists = fs.exists(path)
    if (exists && !options.force) throw new PlanError(`${path} already exists — use --force to overwrite it`)
    edits.push({ path, kind: exists ? "update" : "create", content })
  }

  /** Puts `line` right above `anchor`, indented like it. A missing anchor becomes a warning. */
  const insert = (path: string, anchor: string, line: string) => {
    const text = current(path)
    if (text === null) {
      warnings.push(`${path} is missing — add this yourself:\n  ${line}`)
      return
    }
    if (text.includes(line)) return
    const lines = text.split("\n")
    // Exact match: "klin-anchor:nav" must not match "klin-anchor:nav-icons".
    const pattern = new RegExp(`${escape(anchor)}(?![\\w-])`)
    const at = lines.findIndex((l) => pattern.test(l))
    if (at === -1) {
      warnings.push(`Couldn't find "${anchor}" in ${path} — add this yourself:\n  ${line}`)
      return
    }
    lines.splice(at, 0, `${/^\s*/.exec(lines[at]!)![0]}${line}`)
    const existing = edits.find((e) => e.path === path)
    if (existing) existing.content = lines.join("\n")
    else edits.push({ path, kind: "update", content: lines.join("\n") })
  }

  /** Two `import { PaymentModule }` from different folders would collide. */
  const claim = (path: string, name: string, line: string) => {
    const text = current(path)
    if (text && new RegExp(`\\b${name}\\b`).test(text) && !text.includes(line)) {
      throw new PlanError(`${path} already uses the name ${name} — pick another name${suggestion(target)}`)
    }
  }

  /* ─── packages/validators — shared, so it's reused when it's there ───── */

  const imported = schemaImports(target, { api: backend, web: frontend })
  const validatorFiles = fs.files("packages/validators/src").filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"))
  if (options.validation === false) {
    // Nothing is written there, but the generated code still imports these.
    const missing = imported.filter((name) => !validatorFiles.some((file) => exportsName(fs.read(file) ?? "", name)))
    if (missing.length) warnings.push(`packages/validators doesn't export ${missing.join(", ")} yet — the generated code imports them from @repo/validators`)
  } else if (fs.exists(paths.validators)) {
    edits.push({ path: paths.validators, kind: "keep", note: "already there — reused" })
    const text = fs.read(paths.validators) ?? ""
    const missing = imported.filter((name) => !exportsName(text, name))
    if (missing.length) warnings.push(`${paths.validators} doesn't export ${missing.join(", ")} — the generated code imports them`)
  } else {
    const names = schemaExports(target)
    for (const file of validatorFiles) {
      const taken = names.find((name) => exportsName(fs.read(file) ?? "", name))
      if (taken) throw new PlanError(`${file} already exports ${taken} — pick another name${suggestion(target)}, or reuse its schemas with --no-validation`)
    }
    edits.push({ path: paths.validators, kind: "create", content: validatorsFile(ctx) })
  }
  if (options.validation !== false) {
    const index = "packages/validators/src/index.ts"
    insert(index, "// klin-anchor:exports", `export * from "${importPath(index, paths.validators)}"`)
  }

  /* ─── packages/db ─────────────────────────────────────────────────────── */

  if (model) {
    const model = target.one.pascal
    for (const file of fs.files("packages/db/prisma")) {
      if (!file.endsWith(".prisma") || file === paths.prisma) continue
      if (new RegExp(`^\\s*(model|enum|view|type)\\s+${model}\\s*\\{`, "m").test(fs.read(file) ?? "")) {
        throw new PlanError(`${file} already has a ${model} model — pick another name${suggestion(target)}`)
      }
    }
    write(paths.prisma, prismaFile(ctx, rewriteCommand(`pnpm db:migrate --name add-${target.one.kebab}`, project.pm)))
  }

  /* ─── apps/api ────────────────────────────────────────────────────────── */

  // Another controller or router on the same /api path would shadow this one.
  const urlTaken = (where: string) =>
    new PlanError(`${where} already serves /api/${target.url} — ${target.url === target.path ? "pick another name, or" : "pick another"} --url`)

  if (backend && project.backend === "nest") {
    const appModule = "apps/api/src/app.module.ts"
    const name = `${target.leaf.pascal}Module`
    const line = `import { ${name} } from "${importPath(appModule, paths.nest.module)}"`
    claim(appModule, name, line)
    const controller = new RegExp(`@Controller\\(\\s*["'\`]/?${escape(target.url)}/?["'\`]`)
    for (const file of fs.files("apps/api/src")) {
      if (file.endsWith(".controller.ts") && file !== paths.nest.controller && controller.test(fs.read(file) ?? "")) throw urlTaken(file)
    }
    write(paths.nest.module, api.nestModuleFile(ctx))
    write(paths.nest.dto, api.nestDtoFile(ctx))
    write(paths.nest.controller, api.nestControllerFile(ctx))
    write(paths.nest.service, api.nestServiceFile(ctx))
    insert(appModule, "// klin-anchor:module-imports", line)
    insert(appModule, "// klin-anchor:modules", `${name},`)
  } else if (backend) {
    const app = "apps/api/src/app.ts"
    const fastify = project.server === "fastify"
    const name = fastify ? `${target.leaf.camel}Routes` : `${target.leaf.camel}Router`
    const line = `import { ${name} } from "${importPath(app, paths.plain.routes)}"`
    claim(app, name, line)
    const mounted = (current(app) ?? "").split("\n").some((l) => l.includes(`"/api/${target.url}"`) && !new RegExp(`\\b${name}\\b`).test(l))
    if (mounted) throw urlTaken(app)
    write(paths.plain.service, api.plainServiceFile(ctx))
    write(paths.plain.routes, fastify ? api.fastifyRoutesFile(ctx) : api.expressRoutesFile(ctx))
    insert(app, "// klin-anchor:route-imports", line)
    insert(
      app,
      "// klin-anchor:routes",
      fastify ? `await app.register(${name}, { prefix: "/api/${target.url}" })` : `app.use("/api/${target.url}", ${name})`
    )
  }

  /* ─── apps/web ────────────────────────────────────────────────────────── */

  if (frontend) {
    // With components in packages/ui, shadcn imports come from @repo/ui.
    const shadcn = (code: string) => (project.packagesUi ? web.toUiPackageImports(code) : code)
    write(paths.web.api, web.webApiFile(ctx))
    write(paths.web.form, shadcn(web.webFormFile(ctx)))
    write(paths.web.page, shadcn(web.webPageFile(ctx)))
  }

  if (route) {
    write(paths.web.route, web.webRouteFile(ctx))
    const parent = target.url.split("/").slice(0, -1).join("/")
    const parentRoute = `apps/web/src/routes/_app/${parent}.tsx`
    if (parent && fs.exists(parentRoute)) {
      warnings.push(`${parentRoute} exists, so /${target.url} renders inside it — make sure its component renders <Outlet />`)
    }
  }

  if (nav) {
    const file = "apps/web/src/config/nav.ts"
    const text = current(file)
    const id = target.path.replaceAll("/", "-")
    if (text !== null && !text.includes(`id: "${id}"`)) {
      const icon = web.iconFor(target.one.kebab)
      if (!new RegExp(`\\b${icon}\\b`).test(text)) insert(file, "// klin-anchor:nav-icons", `${icon},`)
      insert(file, "// klin-anchor:nav", `{ id: "${id}", title: "${target.many.title}", to: "/${target.url}", icon: ${icon} },`)
    }
  }

  return { edits, warnings }
}

function exportsName(text: string, name: string) {
  return new RegExp(`export\\s+(?:declare\\s+)?(?:const|let|var|function|class|type|interface|enum)\\s+${name}\\b`).test(text)
}

/** " (e.g. blog/blog-post)" — prefixing the leaf with its folder usually makes it unique. */
function suggestion(target: Target) {
  const parent = target.folders.at(-1)
  return parent ? ` (e.g. ${[...target.folders, `${parent}-${target.leaf.kebab}`].join("/")})` : ""
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
