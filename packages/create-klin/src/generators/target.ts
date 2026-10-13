import { camel, kebab, pascal, pluralizeName, singularizeName, snake, title } from "../utils/names"

/* ─── What can be generated ──────────────────────────────────────────────── */

export const KINDS = ["resource", "backend", "frontend"] as const
export type GenKind = (typeof KINDS)[number]

export const KIND_LABELS: Record<GenKind, string> = {
  resource: "Full-stack resource",
  backend: "Backend module",
  frontend: "Frontend feature",
}

const ALIASES: Record<string, GenKind> = {
  resource: "resource",
  res: "resource",
  r: "resource",
  backend: "backend",
  be: "backend",
  b: "backend",
  api: "backend",
  module: "backend",
  m: "backend",
  frontend: "frontend",
  fe: "frontend",
  f: "frontend",
  web: "frontend",
  feature: "frontend",
}

export function resolveKind(input: string): GenKind | undefined {
  return ALIASES[input.toLowerCase()]
}

/* ─── The name, and every spelling of it the code needs ──────────────────── */

export interface Forms {
  /** blog-post */ kebab: string
  /** blogPost */ camel: string
  /** BlogPost */ pascal: string
  /** blog_post */ snake: string
  /** Blog Post */ title: string
  /** blog post */ lower: string
}

export interface Target {
  /** "blog/post": the folders and the URL under /api. */
  path: string
  /** ["blog"]: organization folders above the leaf. */
  folders: string[]
  /** The last segment as typed: module, controller, service and page names. */
  leaf: Forms
  /** Singular: schemas, DTOs, types and the Prisma model. */
  one: Forms
  /** Plural, for people: page titles, the nav entry. */
  many: Forms
  /** Plural for list-level identifiers — `<singular>List` when both are the same word ("feedback"). */
  list: Forms
}

const forms = (name: string): Forms => ({
  kebab: kebab(name),
  camel: camel(name),
  pascal: pascal(name),
  snake: snake(name),
  title: title(name),
  lower: title(name).toLowerCase(),
})

const SEGMENT = /^[a-zA-Z][a-zA-Z0-9_-]*$/

// Names that become bare identifiers (`const post = …`, `{ post, onDone }`).
const RESERVED = new Set(
  "arguments await break case catch class const continue debugger default delete do else enum eval export extends false finally for function if implements import in instanceof interface let new null package private protected public return static super switch this throw true try typeof var void while with yield".split(" ")
)

/**
 * "blog/post" → folders ["blog"], leaf "post". Leading and trailing slashes
 * are ignored, and every segment is kebab-cased ("blogPost" → "blog-post").
 * Throws a message fit for the user on a bad name.
 */
export function parseTarget(input: string): Target {
  const raw = input.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "")
  if (!raw) throw new Error("Give it a name, like post — or blog/post to put it in a blog folder")
  const parts = raw.split("/").filter(Boolean)
  for (const part of parts) {
    if (!SEGMENT.test(part)) throw new Error(`"${part}" isn't a valid name — use letters, numbers and dashes, starting with a letter`)
  }
  const segments = parts.map(kebab)
  const leaf = segments.at(-1)!
  const singular = singularizeName(leaf)
  const plural = pluralizeName(singular)
  const one = forms(singular)
  const many = forms(plural)
  const list = plural === singular ? forms(`${singular}-list`) : many
  for (const name of [one.camel, list.camel, forms(leaf).camel]) {
    if (RESERVED.has(name)) throw new Error(`"${name}" is a reserved word in JavaScript — pick another name`)
  }
  return { path: segments.join("/"), folders: segments.slice(0, -1), leaf: forms(leaf), one, many, list }
}

/** `klin generate resource blog/post` — written at the top of generated files. */
export const commandFor = (kind: GenKind, target: Target) => `klin generate ${kind} ${target.path}`
