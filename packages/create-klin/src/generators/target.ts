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
  /** "blog/post": the folders, in every layer. */
  path: string
  /** ["blog"]: organization folders above the leaf. */
  folders: string[]
  /** Where it's served: /api/<url> and the page at /<url>. The path, unless --url says otherwise. */
  url: string
  /** The last segment as typed: module, controller, service and page names. */
  leaf: Forms
  /** Singular: schemas, DTOs, types and the Prisma model. */
  one: Forms
  /** Plural, for people: page titles, the nav entry. */
  many: Forms
  /** Plural for list-level identifiers — `<singular>List` when both are the same word ("feedback"). */
  list: Forms
}

/** What flags can change about the name: `--plural people`, `--url invoices`. */
export interface TargetOverrides {
  plural?: string
  url?: string
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
export function parseTarget(input: string, overrides: TargetOverrides = {}): Target {
  const segments = segmentsOf(input, "name")
  if (!segments.length) throw new Error("Give it a name, like post — or blog/post to put it in a blog folder")
  const leaf = segments.at(-1)!
  const singular = singularizeName(leaf)
  const plural = overrides.plural === undefined ? pluralizeName(singular) : pluralOf(overrides.plural)
  const one = forms(singular)
  const many = forms(plural)
  const list = plural === singular ? forms(`${singular}-list`) : many
  for (const name of [one.camel, list.camel, forms(leaf).camel]) {
    if (RESERVED.has(name)) throw new Error(`"${name}" is a reserved word in JavaScript — pick another name`)
  }
  const path = segments.join("/")
  return { path, folders: segments.slice(0, -1), url: overrides.url === undefined ? path : urlOf(overrides.url), leaf: forms(leaf), one, many, list }
}

/** "/Blog//post/" → ["blog", "post"]; throws on a segment that can't be a name. */
function segmentsOf(input: string, what: string) {
  const parts = input.trim().replace(/\\/g, "/").split("/").filter(Boolean)
  for (const part of parts) {
    if (!SEGMENT.test(part)) throw new Error(`"${part}" isn't a valid ${what} — use letters, numbers and dashes, starting with a letter`)
  }
  return parts.map(kebab)
}

/** --plural: one word or name, no folders. */
function pluralOf(input: string) {
  const segments = segmentsOf(input, "plural")
  if (segments.length !== 1) throw new Error("--plural takes a single word, like --plural people")
  return segments[0]!
}

/** --url: "/api/invoices/" → "invoices" (the /api prefix is added for the API anyway). */
function urlOf(input: string) {
  const segments = segmentsOf(input, "URL segment")
  if (segments[0] === "api") segments.shift()
  if (!segments.length) throw new Error("--url needs a path, like --url invoices or --url billing/invoices")
  return segments.join("/")
}

/** `klin generate resource blog/post` — written at the top of generated files. */
export const commandFor = (kind: GenKind, target: Target) => `klin generate ${kind} ${target.path}`
