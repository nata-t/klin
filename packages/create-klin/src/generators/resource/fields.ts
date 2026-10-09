import { camel, kebab, pascal, pluralizeName, snake, title } from "../../utils/names"

export const FIELD_TYPES = ["string", "text", "int", "float", "boolean", "date", "datetime", "enum"] as const
export type FieldType = (typeof FIELD_TYPES)[number]

const ALIASES: Record<string, FieldType> = {
  str: "string",
  varchar: "string",
  longtext: "text",
  integer: "int",
  number: "float",
  decimal: "float",
  double: "float",
  bool: "boolean",
  timestamp: "datetime",
}

export const FIELD_TYPE_HINTS: Record<FieldType, string> = {
  string: "short text, up to 255 characters",
  text: "long text (textarea)",
  int: "whole number",
  float: "decimal number",
  boolean: "on / off switch",
  date: "calendar date",
  datetime: "date and time",
  enum: "one of a fixed list",
}

export interface Field {
  name: string
  label: string
  type: FieldType
  optional: boolean
  values: string[]
}

const RESERVED = new Set(["id", "createdAt", "updatedAt", "userId", "user", "organizationId", "organization"])

/**
 * Parses `name:type[:values][?]`:
 *   title                      → string
 *   budget:int?                → optional int  (also budget:int:optional)
 *   status:enum:draft,published
 */
export function parseField(spec: string): Field {
  let raw = spec.trim()
  let optional = false
  if (raw.endsWith("?")) {
    optional = true
    raw = raw.slice(0, -1)
  }
  const parts = raw.split(":")
  if (parts.at(-1) === "optional" || parts.at(-1) === "opt") {
    optional = true
    parts.pop()
  }
  const [rawName = "", rawType = "string", rawValues = ""] = parts
  const name = camel(rawName)
  if (!name || !/^[a-z][a-zA-Z0-9]*$/.test(name)) throw new Error(`"${rawName}" isn't a valid field name`)
  if (RESERVED.has(name)) throw new Error(`"${name}" is added automatically — pick another field name`)

  const typeName = rawType.toLowerCase()
  const type = (ALIASES[typeName] ?? typeName) as FieldType
  if (!FIELD_TYPES.includes(type)) {
    throw new Error(`Unknown type "${rawType}" for ${name}. Use one of: ${FIELD_TYPES.join(", ")}`)
  }
  const values = rawValues
    .split(/[,|]/)
    .map((v) => v.trim())
    .filter(Boolean)
  if (type === "enum" && values.length < 2) {
    throw new Error(`${name}: enum needs at least two values, e.g. ${name}:enum:draft,published`)
  }
  if (type === "enum" && values.some((v) => !/^[a-zA-Z][\w-]*$/.test(v))) {
    throw new Error(`${name}: enum values must be simple words like draft, in-review, published`)
  }
  return { name, label: title(name), type, optional: type === "boolean" ? false : optional, values }
}

export interface Names {
  /** project */ kebab: string
  /** project */ camel: string
  /** Project */ pascal: string
  /** project */ snake: string
  /** Project */ title: string
  /** project */ lower: string
  plural: {
    /** projects */ kebab: string
    /** projects */ camel: string
    /** Projects */ pascal: string
    /** Projects */ title: string
    /** projects */ lower: string
  }
}

export function makeNames(name: string, pluralOverride?: string): Names {
  const plural = pluralOverride ?? pluralizeName(name)
  return {
    kebab: kebab(name),
    camel: camel(name),
    pascal: pascal(name),
    snake: snake(name),
    title: title(name),
    lower: title(name).toLowerCase(),
    plural: {
      kebab: kebab(plural),
      camel: camel(plural),
      pascal: pascal(plural),
      title: title(plural),
      lower: title(plural).toLowerCase(),
    },
  }
}

export type Scope = "user" | "org" | "none"
export type Database = "postgres" | "mysql" | "sqlite"

export interface ResourceSpec {
  names: Names
  fields: Field[]
  scope: Scope
  database: Database
}

/* ─── Per-type mappings ──────────────────────────────────────────────────── */

const quote = (s: string) => JSON.stringify(s)

/** Zod for the create schema (what a client must send). */
export function zodCreate(field: Field): string {
  const { label } = field
  switch (field.type) {
    case "string":
      return field.optional
        ? `emptyToUndefined(z.string().trim().max(255, "Keep it under 255 characters"))`
        : `z.string().trim().min(1, ${quote(`${label} is required`)}).max(255, "Keep it under 255 characters")`
    case "text":
      return field.optional
        ? `emptyToUndefined(z.string().trim().max(10_000, "Keep it under 10,000 characters"))`
        : `z.string().trim().min(1, ${quote(`${label} is required`)}).max(10_000, "Keep it under 10,000 characters")`
    case "int":
      return `z.number({ error: ${quote(`${label} must be a number`)} }).int(${quote(`${label} must be a whole number`)})${field.optional ? ".optional()" : ""}`
    case "float":
      return `z.number({ error: ${quote(`${label} must be a number`)} })${field.optional ? ".optional()" : ""}`
    case "boolean":
      return `z.boolean()`
    case "date":
    case "datetime":
      return field.optional
        ? `emptyToUndefined(z.coerce.date({ error: ${quote(`${label} must be a valid date`)} }))`
        : `z.coerce.date({ error: ${quote(`${label} must be a valid date`)} })`
    case "enum":
      return `z.enum([${field.values.map(quote).join(", ")}])${field.optional ? ".optional()" : ""}`
  }
}

/** Zod for the update schema: optional text fields can be cleared ("" → null). */
export function zodUpdate(field: Field): string {
  if (!field.optional) return zodCreate(field)
  switch (field.type) {
    case "string":
      return `emptyToNull(z.string().trim().max(255, "Keep it under 255 characters"))`
    case "text":
      return `emptyToNull(z.string().trim().max(10_000, "Keep it under 10,000 characters"))`
    case "date":
    case "datetime":
      return `emptyToNull(z.coerce.date({ error: ${quote(`${field.label} must be a valid date`)} }))`
    default:
      return `${zodCreate(field)}.nullable()`.replace(".optional().nullable()", ".nullable()")
  }
}

/** Zod for the response (wire) shape. */
export function zodWire(field: Field): string {
  const base =
    field.type === "string" || field.type === "text"
      ? "z.string()"
      : field.type === "int"
        ? "z.number().int()"
        : field.type === "float"
          ? "z.number()"
          : field.type === "boolean"
            ? "z.boolean()"
            : field.type === "enum"
              ? `z.enum([${field.values.map(quote).join(", ")}])`
              : "isoDate()"
  return field.optional ? `${base}.nullable()` : base
}

export function prismaType(field: Field, database: Database): string {
  const optional = field.optional ? "?" : ""
  switch (field.type) {
    case "string":
      return `String${optional}${database === "mysql" ? " @db.VarChar(255)" : ""}`
    case "text":
      return `String${optional}${database === "mysql" ? " @db.Text" : ""}`
    case "int":
      return `Int${optional}`
    case "float":
      return `Float${optional}`
    case "boolean":
      return "Boolean  @default(false)"
    case "date":
    case "datetime":
      return `DateTime${optional}`
    case "enum":
      return `String${optional}${database === "mysql" ? " @db.VarChar(64)" : ""}`
  }
}

/** Fields that text search should look through. */
export const searchable = (fields: Field[]) => fields.filter((f) => f.type === "string" || f.type === "text")
