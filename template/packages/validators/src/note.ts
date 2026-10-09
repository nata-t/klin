import { z } from "zod"
import { listQuerySchema, paginatedSchema } from "./api"
import { booleanish, idSchema, isoDate } from "./common"

/**
 * Notes — the example resource, wired end to end:
 *
 *   packages/validators/src/note.ts          ← you are here
 *   packages/db/prisma/models/note.prisma
 *   apps/api/src/modules/notes/*
 *   apps/web/src/features/notes/*
 *   apps/web/src/routes/_app/notes.tsx
 *
 * `klin generate resource <name>` produces this exact shape for a new resource.
 */

const noteFields = {
  title: z
    .string()
    .trim()
    .min(1, "Give your note a title")
    .max(120, "Keep the title under 120 characters"),
  content: z.string().trim().max(10_000, "Keep it under 10,000 characters"),
  pinned: z.boolean(),
}

/* ─── Requests ───────────────────────────────────────────────────────────── */

export const createNoteSchema = z.object({
  ...noteFields,
  content: noteFields.content.default(""),
  pinned: noteFields.pinned.default(false),
})

/** PATCH semantics: every field optional, no defaults (omitted = unchanged). */
export const updateNoteSchema = z.object(noteFields).partial()

export const noteListQuerySchema = listQuerySchema.extend({
  pinned: booleanish().optional(),
  sortBy: z.enum(["createdAt", "updatedAt", "title"]).default("createdAt"),
})

/* ─── Responses ──────────────────────────────────────────────────────────── */

export const noteSchema = z.object({
  id: idSchema,
  title: z.string(),
  content: z.string(),
  pinned: z.boolean(),
  createdAt: isoDate(),
  updatedAt: isoDate(),
})

export const noteListSchema = paginatedSchema(noteSchema)

/* ─── Types ──────────────────────────────────────────────────────────────── */

export type Note = z.output<typeof noteSchema>
export type NoteList = z.output<typeof noteListSchema>
export type CreateNoteInput = z.input<typeof createNoteSchema>
export type CreateNote = z.output<typeof createNoteSchema>
export type UpdateNoteInput = z.input<typeof updateNoteSchema>
export type UpdateNote = z.output<typeof updateNoteSchema>
export type NoteListQueryInput = z.input<typeof noteListQuerySchema>
export type NoteListQuery = z.output<typeof noteListQuerySchema>
