import { SerializeOptions } from "@nestjs/common"
import type { ZodType } from "zod"

/**
 * Shapes the response with a schema from @repo/validators: unknown fields are
 * stripped (no accidental leaks), Dates become ISO strings, and the result is
 * exactly the type the web app expects.
 *
 *   @Get(":id")
 *   @ResponseSchema(noteSchema)
 *   get(...) { return this.notes.get(...) }
 */
export const ResponseSchema = (schema: ZodType) => SerializeOptions({ schema })
