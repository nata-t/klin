import { z } from "zod"

/**
 * Browser-visible configuration. Only VITE_* variables reach the browser —
 * never put secrets in them.
 */
const schema = z.object({
  VITE_API_URL: z
    .union([z.url(), z.literal("")])
    .optional()
    .transform((value) => (value ? value.replace(/\/$/, "") : undefined)),
})

export const env = schema.parse(import.meta.env)
