// klin:file api-keys
import { z } from "zod"

export const API_KEY_EXPIRY = {
  "7": "7 days",
  "30": "30 days",
  "90": "90 days",
  "365": "1 year",
  never: "Never",
} as const

export const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Give the key a name").max(50),
  expiresIn: z.enum(["7", "30", "90", "365", "never"]),
})
export type CreateApiKeyInput = z.input<typeof createApiKeySchema>
