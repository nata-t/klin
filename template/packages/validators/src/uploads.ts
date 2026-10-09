// klin:file uploads
import { z } from "zod"

export const MAX_UPLOAD_MB = 10
export const MAX_AVATAR_MB = 5
export const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const

export const UPLOAD_PURPOSES = ["avatar", "attachment"] as const
export type UploadPurpose = (typeof UPLOAD_PURPOSES)[number]

/** Ask the API for a presigned URL to upload one file straight to storage. */
export const presignUploadSchema = z
  .object({
    filename: z.string().trim().min(1).max(200),
    contentType: z
      .string()
      .regex(/^[\w.+-]+\/[\w.+-]+$/, "That doesn't look like a file type"),
    size: z
      .number()
      .int()
      .positive()
      .max(MAX_UPLOAD_MB * 1024 * 1024, `Files must be ${MAX_UPLOAD_MB}MB or smaller`),
    purpose: z.enum(UPLOAD_PURPOSES).default("attachment"),
  })
  .refine(
    (file) =>
      file.purpose !== "avatar" ||
      (IMAGE_TYPES.includes(file.contentType as (typeof IMAGE_TYPES)[number]) &&
        file.size <= MAX_AVATAR_MB * 1024 * 1024),
    { message: `Avatars must be PNG, JPG, WEBP or GIF up to ${MAX_AVATAR_MB}MB`, path: ["contentType"] }
  )

export const presignedUploadSchema = z.object({
  /** PUT the file here. */
  uploadUrl: z.url(),
  /** Storage key — what you save in your database. */
  key: z.string(),
  /** Stable URL (served by the API) to read the file back. */
  fileUrl: z.string(),
  /** Headers the PUT must include. */
  headers: z.record(z.string(), z.string()),
  expiresIn: z.number().int(),
})

export type PresignUploadInput = z.input<typeof presignUploadSchema>
export type PresignedUpload = z.output<typeof presignedUploadSchema>
