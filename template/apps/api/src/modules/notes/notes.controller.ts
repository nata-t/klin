import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from "@nestjs/common"
import { ZodSerializerDto } from "nestjs-zod"
import { CurrentUser } from "../../common"
import { CreateNoteDto, NoteDto, NoteListDto, NoteListQueryDto, UpdateNoteDto } from "./notes.dto"
import { NotesService } from "./notes.service"

/**
 * /api/notes — every route requires a signed-in user (global AuthGuard) and
 * only ever touches that user's notes.
 *
 * Bodies and queries are validated through their nestjs-zod DTOs; responses
 * are shaped by @ZodSerializerDto. Every DTO is built from a schema in
 * @repo/validators, the same one the web app's forms and types use.
 */
@Controller("notes")
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  @ZodSerializerDto(NoteListDto)
  list(@CurrentUser("id") userId: string, @Query() query: NoteListQueryDto) {
    return this.notes.list(userId, query)
  }

  @Get(":id")
  @ZodSerializerDto(NoteDto)
  get(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.notes.get(userId, id)
  }

  @Post()
  @ZodSerializerDto(NoteDto)
  create(@CurrentUser("id") userId: string, @Body() input: CreateNoteDto) {
    return this.notes.create(userId, input)
  }

  @Patch(":id")
  @ZodSerializerDto(NoteDto)
  update(@CurrentUser("id") userId: string, @Param("id") id: string, @Body() input: UpdateNoteDto) {
    return this.notes.update(userId, id, input)
  }

  @Delete(":id")
  remove(@CurrentUser("id") userId: string, @Param("id") id: string) {
    return this.notes.remove(userId, id)
  }
}
