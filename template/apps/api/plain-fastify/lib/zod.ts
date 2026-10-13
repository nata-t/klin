import type {
  FastifyPluginAsync,
  FastifySchemaCompiler,
  FastifyTypeProvider,
  RawServerDefault,
} from "fastify"
import type { z } from "zod"

/**
 * Zod for Fastify routes, in two small pieces:
 *
 * - `ZodTypeProvider` makes `request.body`, `request.query` and
 *   `request.params` the parsed (z.infer) types of the schemas on the route.
 * - `zodValidatorCompiler` validates with those schemas at runtime; failures
 *   reach the error handler as a ZodError (→ 422 with per-field details).
 *
 *   app.post("/", { schema: { body: createNoteSchema } }, async (request) => {
 *     request.body // CreateNote
 *   })
 */
export interface ZodTypeProvider extends FastifyTypeProvider {
  validator: this["schema"] extends z.ZodType ? z.output<this["schema"]> : unknown
  serializer: this["schema"] extends z.ZodType ? z.input<this["schema"]> : unknown
}

export const zodValidatorCompiler: FastifySchemaCompiler<z.ZodType> =
  ({ schema }) =>
  (data) => {
    const result = schema.safeParse(data)
    return result.success ? { value: result.data } : { error: result.error }
  }

/** A route plugin whose schemas are Zod schemas. */
export type ZodPlugin = FastifyPluginAsync<Record<never, never>, RawServerDefault, ZodTypeProvider>
