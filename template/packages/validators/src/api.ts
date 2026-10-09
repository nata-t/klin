import { z } from "zod"

/**
 * The API envelope. Every response from the NestJS app has one of these two
 * shapes — the global response interceptor and exception filter guarantee it,
 * and the web API client unwraps it.
 */

export interface PaginationMeta {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface ApiSuccessResponse<T> {
  success: true
  data: T
  meta: {
    timestamp: string
    path: string
    method: string
    requestId?: string
    pagination?: PaginationMeta
  }
}

export interface ValidationIssue {
  field: string
  message: string
}

export interface ApiErrorResponse {
  success: false
  error: {
    code: ApiErrorCode | (string & {})
    message: string
    statusCode: number
    details?: ValidationIssue[]
    stack?: string
  }
  meta: {
    timestamp: string
    path: string
    method: string
    requestId?: string
  }
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse

export const API_ERROR_CODES = [
  "BAD_REQUEST",
  "VALIDATION_ERROR",
  "UNAUTHORIZED",
  "FORBIDDEN",
  "NOT_FOUND",
  "CONFLICT",
  "TOO_MANY_REQUESTS",
  "INTERNAL_SERVER_ERROR",
  "NETWORK_ERROR",
] as const

export type ApiErrorCode = (typeof API_ERROR_CODES)[number]

/* ─── Lists ──────────────────────────────────────────────────────────────── */

export const paginationMetaSchema = z.object({
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  total: z.number().int().nonnegative(),
  totalPages: z.number().int().nonnegative(),
})

/**
 * Base query for list endpoints. Query strings arrive as strings, so numbers
 * are coerced. Extend it per resource:
 *
 *   export const noteListQuerySchema = listQuerySchema.extend({ pinned: booleanish().optional() })
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(200).optional(),
  sortOrder: z.enum(["asc", "desc"]).default("desc"),
})

export type ListQuery = z.output<typeof listQuerySchema>
export type ListQueryInput = z.input<typeof listQuerySchema>

/** `{ items, pagination }` — the `data` of every paginated endpoint. */
export const paginatedSchema = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    pagination: paginationMetaSchema,
  })

export interface Paginated<T> {
  items: T[]
  pagination: PaginationMeta
}
