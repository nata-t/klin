import type { ApiErrorResponse, ValidationIssue } from "@repo/validators"

/** Every failed API call rejects with one of these. */
export class ApiError extends Error {
  readonly code: string
  readonly status: number
  readonly details: ValidationIssue[]
  readonly requestId?: string

  constructor(body: ApiErrorResponse) {
    super(body.error.message)
    this.name = "ApiError"
    this.code = body.error.code
    this.status = body.error.statusCode
    this.details = body.error.details ?? []
    this.requestId = body.meta.requestId
  }

  /** Field → message, for showing server-side validation errors next to inputs. */
  get fieldErrors(): Record<string, string> {
    return Object.fromEntries(this.details.map((d) => [d.field, d.message]))
  }

  static synthetic(status: number, code: string, message: string, method: string, path: string) {
    return new ApiError({
      success: false,
      error: { code, message, statusCode: status },
      meta: { timestamp: new Date().toISOString(), path, method },
    })
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError
}

/** A readable message from anything thrown. */
export function errorMessage(error: unknown, fallback = "Something went wrong"): string {
  if (error instanceof Error && error.message) return error.message
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === "string" && message) return message
  }
  return fallback
}
