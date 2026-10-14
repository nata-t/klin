import type { ProjectConfig } from "../utils/project"
import type { Project, Reader, Web } from "./plan"

/*
 * Where each layer's files go. klin has a default for each, a project can
 * change them in klin.json (`klin generate paths`), and one run can override
 * them with --backend-dir & co. or on the "Where should it go?" page.
 */

export const LAYERS = ["backend", "frontend", "validation", "model"] as const
export type Layer = (typeof LAYERS)[number]
export type Dirs = Record<Layer, string>

export const LAYER_LABELS: Record<Layer, string> = {
  backend: "Backend",
  frontend: "Frontend",
  validation: "Validation",
  model: "Prisma models",
}

/** `--backend-dir` … `--model-dir`. */
export const DIR_FLAGS: Record<Layer, string> = {
  backend: "backend-dir",
  frontend: "frontend-dir",
  validation: "validation-dir",
  model: "model-dir",
}

/**
 * Each layer stays inside the folder its build reads, so imports, the
 * tsconfig and Prisma still find it — and out of folders with another job.
 */
const RULES: Record<Layer, { root: string; why: string }> = {
  backend: { root: "apps/api/src", why: "the API's source, where its build and imports look" },
  frontend: { root: "apps/web/src", why: "the web app's source, where the @/ imports point" },
  validation: { root: "packages/validators/src", why: "the source of @repo/validators, which both apps import" },
  model: { root: "packages/db/prisma", why: "the folder Prisma reads every .prisma file from" },
}

/** Folders inside a layer's root that belong to something else. */
function offLimits(layer: Layer, web: Web): Array<[dir: string, why: string]> {
  if (layer === "frontend") {
    return web === "next"
      ? [["apps/web/src/app", "the Next.js App Router turns its folders into pages"]]
      : [["apps/web/src/routes", "TanStack Router turns every file in there into a route"]]
  }
  if (layer === "model") return [["packages/db/prisma/migrations", "Prisma keeps its migrations there"]]
  return []
}

/** klin's own defaults. Plain backends keep routes/ and services/ in the backend folder. */
export function defaultDirs(project: Pick<Project, "backend">): Dirs {
  return {
    backend: project.backend === "nest" ? "apps/api/src/modules" : "apps/api/src",
    frontend: "apps/web/src/features",
    validation: "packages/validators/src",
    model: "packages/db/prisma/models",
  }
}

/** What the folder setting means for a layer — the help text on the paths pages. */
export function aboutDir(layer: Layer, project: Pick<Project, "backend" | "web">): string {
  const { root } = RULES[layer]
  const blocked = offLimits(layer, project.web)
  const where = `It has to be inside ${root}${blocked.length ? `, but not in ${blocked.map(([dir]) => `${dir.slice(root.length + 1)}/`).join(" or ")}` : ""}.`
  switch (layer) {
    case "backend":
      return project.backend === "nest"
        ? `The folder NestJS modules go in — each gets a folder of its own inside it. ${where}`
        : `The folder holding routes/ and services/ — a backend's routes file and service go in those. ${where}`
    case "frontend":
      return `Where feature folders go: the page, the form and the query hooks (the ${project.web === "next" ? "page.tsx stays in app/(app)" : "route file stays in routes/_app"}). ${where}`
    case "validation":
      return `Where the schema files go; they're exported from the package's index either way. ${where}`
    case "model":
      return `Where Prisma models go. ${where}`
  }
}

/**
 * Checks and normalizes a folder for a layer: relative to the project root,
 * no `..`, plain folder names, inside the layer's root and out of folders
 * with another job, and not an existing file. Throws a message fit for the user.
 *
 *   parseDir("frontend", "./apps/web/src/pages/")  → "apps/web/src/pages"
 */
export function parseDir(layer: Layer, input: string, fs?: Pick<Reader, "read">, web: Web = "vite"): string {
  const { root, why } = RULES[layer]
  const raw = input.trim().replace(/\\/g, "/")
  if (!raw) throw new Error(`Give it a folder, like ${root}/…`)
  if (raw.startsWith("/") || raw.startsWith("~") || /^[a-zA-Z]:/.test(raw)) {
    throw new Error(`Use a folder inside the project, from its root — like ${root}/…`)
  }
  const parts = raw.split("/").filter((part) => part && part !== ".")
  for (const part of parts) {
    if (part === "..") throw new Error(`".." would step outside — write the folder from the project root, like ${root}/…`)
    if (!/^[A-Za-z0-9_][A-Za-z0-9._-]*$/.test(part)) {
      throw new Error(`"${part}" isn't a valid folder name — use letters, numbers, dots, dashes and underscores`)
    }
  }
  const dir = parts.join("/")
  if (dir !== root && !dir.startsWith(`${root}/`)) throw new Error(`It has to be inside ${root} — ${why}`)
  for (const [blocked, reason] of offLimits(layer, web)) {
    if (dir === blocked || dir.startsWith(`${blocked}/`)) throw new Error(`Not inside ${blocked} — ${reason}`)
  }
  if (fs?.read(dir) != null) throw new Error(`${dir} is a file, not a folder`)
  return dir
}

/** The project's defaults: klin's, with klin.json's `generate.paths` on top. */
export function projectDirs(config: ProjectConfig, project: Pick<Project, "backend" | "web">, fs?: Pick<Reader, "read">): Dirs {
  const dirs = defaultDirs(project)
  const saved = config.generate?.paths ?? {}
  for (const layer of LAYERS) {
    const value = saved[layer]
    if (value === undefined) continue
    try {
      dirs[layer] = parseDir(layer, String(value), fs, project.web)
    } catch (error) {
      throw new Error(`klin.json → generate.paths.${layer}: ${(error as Error).message} (fix it, or run \`klin generate paths --reset\`)`)
    }
  }
  return dirs
}

/**
 * The config with `dirs` as its defaults. Only folders that differ from
 * klin's own are written, so klin.json stays short and follows klin's defaults.
 */
export function withDirs(config: ProjectConfig, project: Pick<Project, "backend">, dirs: Dirs): ProjectConfig {
  const builtIn = defaultDirs(project)
  const paths = Object.fromEntries(LAYERS.filter((layer) => dirs[layer] !== builtIn[layer]).map((layer) => [layer, dirs[layer]]))
  const { generate, ...rest } = config
  const { paths: _old, ...others } = generate ?? {}
  const next: NonNullable<ProjectConfig["generate"]> = Object.keys(paths).length ? { ...others, paths } : others
  return Object.keys(next).length ? { ...rest, generate: next } : rest
}
