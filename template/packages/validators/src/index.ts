/**
 * @repo/validators — the single source of truth for data shapes.
 *
 * Every schema here is used on both sides of the wire:
 *   • the API validates requests with it    → class CreateNoteDto extends createZodDto(createNoteSchema) {}   (NestJS, nestjs-zod)
 *                                              createNoteSchema.parse(req.body)                             (plain Express / Fastify)
 *   • the API shapes responses with it      → @ZodSerializerDto(NoteDto) · noteSchema.parse(note)
 *   • the web app validates forms with it   → useAppForm({ validators: { onDynamic: createNoteSchema } })
 *   • TypeScript types are inferred from it → type Note = z.infer<typeof noteSchema>
 *
 * Change a rule once, and both sides agree. `klin generate resource` adds new
 * files here and re-exports them below (keep the marker comment).
 */
export * from "./common"
export * from "./api"
export * from "./auth"
export * from "./note"
export * from "./uploads" // klin:only uploads
export * from "./organization" // klin:only organizations
export * from "./api-key" // klin:only api-keys
export * from "./admin" // klin:only admin
// klin-anchor:exports
