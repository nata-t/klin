// klin:file uploads
import { presignedUploadSchema, presignUploadSchema } from "@repo/validators"
import { Router } from "express"
import { ok } from "../lib/http"
import { requireAuth } from "../middleware/auth"
import { presignUpload, readUrl } from "../services/uploads"

export const uploadsRouter = Router()

/** POST /api/uploads/presign → { uploadUrl, key, fileUrl, headers } */
uploadsRouter.post("/presign", requireAuth, async (req, res) => {
  const input = presignUploadSchema.parse(req.body)
  const upload = await presignUpload(res.locals.auth.user.id, input)
  res.json(ok(req, presignedUploadSchema.parse(upload)))
})

/** GET /api/uploads/file/<key> → 302 to a short-lived signed URL. Public so <img> tags work. */
uploadsRouter.get("/file/*key", async (req, res) => {
  const key = req.params.key as string | string[]
  res.setHeader("Cache-Control", "private, max-age=3000")
  res.redirect(302, await readUrl(Array.isArray(key) ? key.join("/") : key))
})
