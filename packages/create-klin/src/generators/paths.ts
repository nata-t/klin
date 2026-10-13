import { posix } from "node:path"
import type { GenKind, Target } from "./target"

/** Where every generated file goes. Organization folders nest the same way in each layer. */
export interface Paths {
  validators: string
  prisma: string
  nest: { dir: string; module: string; dto: string; controller: string; service: string }
  plain: { routes: string; service: string }
  web: { dir: string; api: string; page: string; form: string; route: string }
}

export function pathsFor(t: Target): Paths {
  const entity = [...t.folders, t.one.kebab].join("/")
  const nestDir = `apps/api/src/modules/${t.path}`
  const webDir = `apps/web/src/features/${t.path}`
  return {
    validators: `packages/validators/src/${entity}.ts`,
    prisma: `packages/db/prisma/models/${entity}.prisma`,
    nest: {
      dir: nestDir,
      module: `${nestDir}/${t.leaf.kebab}.module.ts`,
      dto: `${nestDir}/${t.leaf.kebab}.dto.ts`,
      controller: `${nestDir}/${t.leaf.kebab}.controller.ts`,
      service: `${nestDir}/${t.leaf.kebab}.service.ts`,
    },
    plain: {
      routes: `apps/api/src/routes/${t.path}.ts`,
      service: `apps/api/src/services/${t.path}.ts`,
    },
    web: {
      dir: webDir,
      api: `${webDir}/api.ts`,
      page: `${webDir}/${t.leaf.kebab}-page.tsx`,
      form: `${webDir}/${t.one.kebab}-form.tsx`,
      route: `apps/web/src/routes/_app/${t.url}.tsx`,
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
}

/** A local variable name that can't shadow the code around it (`const id = … { id }`). */
export function local(name: string) {
  return LOCALS.has(name) ? "record" : name
}
const LOCALS = new Set(["id", "input", "query", "where", "items", "total", "prisma", "router", "app", "request", "reply", "req", "res", "ok", "params", "z", "api", "form", "field", "value", "error"])
