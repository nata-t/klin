import { z } from "zod"

/* ─── Primitives ─────────────────────────────────────────────────────────── */

export const idSchema = z.string().min(1, "Missing id")

export const emailSchema = z
  .email("Enter a valid email address")
  .trim()
  .toLowerCase()
  .max(255, "Email must be at most 255 characters")

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Use at most 128 characters")

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name must be at least 2 characters")
  .max(60, "Name must be at most 60 characters")

export const urlSchema = z.url("Enter a valid URL (e.g. https://example.com)")

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(2, "Use at least 2 characters")
  .max(48, "Use at most 48 characters")
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and dashes")

/* ─── Wire helpers ───────────────────────────────────────────────────────── */

/**
 * A timestamp on the wire. Accepts a `Date` (what Prisma returns) or an ISO
 * string (what JSON carries) and always outputs an ISO string, so the inferred
 * type matches what the browser actually receives.
 */
export const isoDate = () =>
  z
    .union([z.date(), z.iso.datetime({ offset: true })])
    .transform((value) =>
      typeof value === "string" ? value : value.toISOString()
    )

/** Query-string booleans: "true" / "false" / "1" / "0". */
export const booleanish = () =>
  z
    .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
    .transform((value) => value === true || value === "true" || value === "1")

/** Turns "" into `undefined` so optional form fields stay optional. */
export const emptyToUndefined = <T extends z.ZodType>(schema: T) =>
  z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    schema.optional()
  )

/** For updates: "" means "clear it" (null); omitted means "leave it". */
export const emptyToNull = <T extends z.ZodType>(schema: T) =>
  z.preprocess((value) => (value === "" ? null : value), schema.nullable().optional())
