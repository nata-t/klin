import {
  createNoteSchema,
  idSchema,
  noteListQuerySchema,
  noteListSchema,
  noteSchema,
  updateNoteSchema,
} from "@repo/validators"
import { Router } from "express"
import { ok } from "../lib/http"
import { requireAuth } from "../middleware/auth"
import * as notes from "../services/notes"

/**
 * /api/notes — signed-in users only, and only ever their own notes.
 *
 * The schemas come from @repo/validators, the same ones the web app's forms
 * use. `schema.parse()` validates and types the input (a ZodError becomes a
 * 422 with per-field details); parsing the result through the response schema
 * strips fields like userId and turns dates into ISO strings.
 */
export const notesRouter = Router()
notesRouter.use(requireAuth)

notesRouter.get("/", async (req, res) => {
  const query = noteListQuerySchema.parse(req.query)
  const list = await notes.listNotes(res.locals.auth.user.id, query)
  res.json(ok(req, noteListSchema.parse(list)))
})

notesRouter.get("/:id", async (req, res) => {
  const note = await notes.getNote(res.locals.auth.user.id, idSchema.parse(req.params.id))
  res.json(ok(req, noteSchema.parse(note)))
})

notesRouter.post("/", async (req, res) => {
  const input = createNoteSchema.parse(req.body)
  const note = await notes.createNote(res.locals.auth.user.id, input)
  res.status(201).json(ok(req, noteSchema.parse(note)))
})

notesRouter.patch("/:id", async (req, res) => {
  const input = updateNoteSchema.parse(req.body)
  const note = await notes.updateNote(res.locals.auth.user.id, idSchema.parse(req.params.id), input)
  res.json(ok(req, noteSchema.parse(note)))
})

notesRouter.delete("/:id", async (req, res) => {
  res.json(ok(req, await notes.deleteNote(res.locals.auth.user.id, idSchema.parse(req.params.id))))
})
