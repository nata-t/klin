// klin:file admin
import { z } from "zod"

export const adminStatsSchema = z.object({
  users: z.number().int(),
  newUsers: z.number().int(),
  activeSessions: z.number().int(),
  banned: z.number().int(),
})
export type AdminStats = z.output<typeof adminStatsSchema>
