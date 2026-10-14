import { posix } from "node:path"
import type { Dirs } from "./dirs"
import type { Web } from "./plan"
import type { GenKind, Target } from "./target"

/** Where every generated file goes. Organization folders nest the same way in each layer. */
export interface Paths {
  validators: string
  prisma: string
  nest: { dir: string; module: string; dto: string; controller: string; service: string }
  plain: { routes: string; service: string }
  web: { dir: string; api: string; page: string; form: string; route: string }
}

/** `dirs` are the layer folders (klin's defaults, the project's, or this run's). */
export function pathsFor(t: Target, dirs: Dirs, web: Web): Paths {
  const entity = [...t.folders, t.one.kebab].join("/")
  const nestDir = `${dirs.backend}/${t.path}`
  const webDir = `${dirs.frontend}/${t.path}`
  return {
    validators: `${dirs.validation}/${entity}.ts`,
    prisma: `${dirs.model}/${entity}.prisma`,
    nest: {
      dir: nestDir,
      module: `${nestDir}/${t.leaf.kebab}.module.ts`,
      dto: `${nestDir}/${t.leaf.kebab}.dto.ts`,
      controller: `${nestDir}/${t.leaf.kebab}.controller.ts`,
      service: `${nestDir}/${t.leaf.kebab}.service.ts`,
    },
    plain: {
      // Plain backends keep the template's routes/ and services/ inside the backend folder.
      routes: `${dirs.backend}/routes/${t.path}.ts`,
      service: `${dirs.backend}/services/${t.path}.ts`,
    },
    web: {
      dir: webDir,
      api: `${webDir}/api.ts`,
      page: `${webDir}/${t.leaf.kebab}-page.tsx`,
      form: `${webDir}/${t.one.kebab}-form.tsx`,
      // Page files stay where the router looks for them.
      route: web === "next" ? `apps/web/src/app/(app)/${t.url}/page.tsx` : `apps/web/src/routes/_app/${t.url}.tsx`,
    },
  }
}

/** The import specifier for `to` from inside `from`: "../../common". */
export function importPath(from: string, to: string) {
  const relative = posix.relative(posix.dirname(from), to).replace(/(\/index)?\.tsx?$/, "")
  return relative.startsWith(".") ? relative : `./${relative}`
}

/** What every template gets. */
export interface TemplateContext {
  target: Target
  kind: GenKind
  paths: Paths
  /** `klin generate resource blog/post` */
  command: string
  /** A Prisma model comes with it, so services can query it instead of leaving TODOs. */
  withModel: boolean
  /** What runs apps/web. */
  web: Web
}

/** A local variable name that can't shadow the code around it (`const id = … { id }`). */
export function local(name: string) {
  return LOCALS.has(name) ? "record" : name
}
const LOCALS = new Set(["id", "input", "query", "where", "items", "total", "prisma", "router", "app", "request", "reply", "req", "res", "ok", "params", "z", "api", "form", "field", "value", "error"])
