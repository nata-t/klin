import {
  createNoteSchema,
  noteListQuerySchema,
  noteListSchema,
  noteSchema,
  updateNoteSchema,
} from "@repo/validators"
import { createZodDto } from "nestjs-zod"

/**
 * DTOs made from the shared schemas in @repo/validators — the same schemas the
 * web app validates its forms with, so a form that passes there passes here.
 *
 * - Request DTOs (@Body, @Query) are validated by the global ZodValidationPipe:
 *   defaults applied, strings coerced, a 422 with per-field details on failure.
 * - Response DTOs go in @ZodSerializerDto: whatever the handler returns is run
 *   through the schema, so unlisted fields (like userId) never leave the API.
 *
 * The class *is* the type: `input: CreateNoteDto` is `z.infer<typeof createNoteSchema>`.
 */
export class CreateNoteDto extends createZodDto(createNoteSchema) {}
export class UpdateNoteDto extends createZodDto(updateNoteSchema) {}
export class NoteListQueryDto extends createZodDto(noteListQuerySchema) {}

export class NoteDto extends createZodDto(noteSchema) {}
export class NoteListDto extends createZodDto(noteListSchema) {}
