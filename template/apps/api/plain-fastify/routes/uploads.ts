// klin:file uploads
import { presignedUploadSchema, presignUploadSchema } from "@repo/validators"
import { requireAuth } from "../hooks/auth"
import { ok } from "../lib/http"
import type { ZodPlugin } from "../lib/zod"
import { presignUpload, readUrl } from "../services/uploads"

export const uploadsRoutes: ZodPlugin = async (app) => {
  /** POST /api/uploads/presign → { uploadUrl, key, fileUrl, headers } */
  app.post("/presign", { preHandler: requireAuth, schema: { body: presignUploadSchema } }, async (request) => {
    const upload = await presignUpload(request.auth.user.id, request.body)
    return ok(request, presignedUploadSchema.parse(upload))
  })

  /** GET /api/uploads/file/<key> → 302 to a short-lived signed URL. Public so <img> tags work. */
  app.get<{ Params: { "*": string } }>("/file/*", async (request, reply) => {
    reply.header("Cache-Control", "private, max-age=3000")
    return reply.redirect(await readUrl(request.params["*"]), 302)
  })
}
