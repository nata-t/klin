import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import {
  type CreateNote,
  createNoteSchema,
  type NoteListQuery,
  noteListQuerySchema,
  noteListSchema,
  noteSchema,
  type UpdateNote,
  updateNoteSchema,
} from "@repo/validators"
import { CurrentUser, ResponseSchema } from "../../common"
import { NotesService } from "./notes.service"

/**
 * /api/notes — every route requires a signed-in user (global AuthGuard) and
 * only ever touches that user's notes.
 *
 * Request bodies and queries are validated by the schemas passed to @Body /
 * @Query; responses are shaped by @ResponseSchema. All of them come from
 * @repo/validators, the same schemas the web app's forms use.
 */
@Controller("notes")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ResponseSchema(noteListSchema)
  list(
    @CurrentUser("id") userId: string,
    @Query({ schema: noteListQuerySchema }) query: NoteListQuery
  ) {
    return this.notes.list(userId, query)
  }

  @Get(":id")
  @ResponseSchema(noteSchema)
  get(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.notes.get(userId, id)
  }

  @Post()
  @ResponseSchema(noteSchema)
  create(
    @CurrentUser("id") userId: string,
    @Body({ schema: createNoteSchema }) input: CreateNote
  ) {
    return this.notes.create(userId, input)
  }

  @Patch(":id")
  @ResponseSchema(noteSchema)
  update(
    @CurrentUser("id") userId: string,
    @Param("id") id: string,
    @Body({ schema: updateNoteSchema }) input: UpdateNote
  ) {
    return this.notes.update(userId, id, input)
  }

  @Delete(":id")
  remove(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.notes.remove(userId, id)
  }
}
