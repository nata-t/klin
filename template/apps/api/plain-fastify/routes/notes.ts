import {
  createNoteSchema,
  idSchema,
  noteListQuerySchema,
  noteListSchema,
  noteSchema,
  updateNoteSchema,
} from "@repo/validators"
import { z } from "zod"
import { requireAuth } from "../hooks/auth"
import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"
import * as notes from "../services/notes"

const params = z.object({ id: idSchema })

/**
 * /api/notes — signed-in users only, and only ever their own notes.
 *
 * The route schemas come from @repo/validators, the same ones the web app's
 * forms use: Fastify validates body/query/params with them (a failure becomes
 * a 422 with per-field details) and types `request.body` & co. from them.
 * Results are parsed through the response schema, which strips fields like
 * userId and turns dates into ISO strings.
 */
export const notesRoutes: ZodPlugin = async (app) => {
  app.addHook("preHandler", requireAuth)

  app.get("/", { schema: { querystring: noteListQuerySchema } }, async (request) => {
    const list = await notes.listNotes(request.auth.user.id, request.query)
    return ok(request, noteListSchema.parse(list))
  })

  app.get("/:id", { schema: { params } }, async (request) => {
    const note = await notes.getNote(request.auth.user.id, request.params.id)
    return ok(request, noteSchema.parse(note))
  })

  app.post("/", { schema: { body: createNoteSchema } }, async (request, reply) => {
    const note = await notes.createNote(request.auth.user.id, request.body)
    return reply.code(201).send(ok(request, noteSchema.parse(note)))
  })

  app.patch("/:id", { schema: { params, body: updateNoteSchema } }, async (request) => {
    const note = await notes.updateNote(request.auth.user.id, request.params.id, request.body)
    return ok(request, noteSchema.parse(note))
  })

  app.delete("/:id", { schema: { params } }, async (request) => {
    return ok(request, await notes.deleteNote(request.auth.user.id, request.params.id))
  })
}
