import { Prisma } from "@repo/db"
import { isProduction } from "@repo/env"
import {
  type ApiErrorResponse,
  type ApiSuccessResponse,
  type PaginationMeta,
  toValidationIssues,
  type ValidationIssue,
} from "@repo/validators"
import { ZodError } from "zod"

/**
 * The response envelope and error mapping, shared by every route.
 *
 *   { success: true, data, meta }            ← ok(req, data)
 *   { success: false, error: { code, … } }   ← whatever a handler throws
 *
 * Handlers just throw: a ZodError from `schema.parse()` becomes a 422 with
 * per-field details, an HttpError keeps its status, Prisma's "unique" and
 * "not found" errors become 409 / 404, and anything else is a logged 500.
 */

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: ValidationIssue[]
  ) {
    super(message)
    this.name = "HttpError"
  }
}

export const badRequest = (message: string) => new HttpError(400, "BAD_REQUEST", message)
export const unauthorized = (message = "You need to sign in first") => new HttpError(401, "UNAUTHORIZED", message)
export const forbidden = (message = "You don't have access to this") => new HttpError(403, "FORBIDDEN", message)
export const notFound = (message = "Not found") => new HttpError(404, "NOT_FOUND", message)
export const tooManyRequests = () => new HttpError(429, "TOO_MANY_REQUESTS", "Too many requests — slow down a little.")
export const serviceUnavailable = (code: string, message: string) => new HttpError(503, code, message)

/** What the envelope needs from a request — the same on Express and Fastify. */
export interface RequestLike {
  url: string
  originalUrl?: string
  method: string
  id?: unknown
}

function meta(request: RequestLike) {
  return {
    timestamp: new Date().toISOString(),
    path: request.originalUrl ?? request.url,
    method: request.method,
    ...(request.id !== undefined && { requestId: String(request.id) }),
  }
}

/** Wraps data in the success envelope (paginated lists also get `meta.pagination`). */
export function ok<T>(request: RequestLike, data: T): ApiSuccessResponse<T> {
  const pagination =
    typeof data === "object" && data !== null && "pagination" in data
      ? (data as { pagination: PaginationMeta }).pagination
      : undefined
  return { success: true, data, meta: { ...meta(request), ...(pagination && { pagination }) } }
}

export interface ErrorShape {
  status: number
  code: string
  message: string
  details?: ValidationIssue[]
}

const STATUS_CODES: Record<number, string> = {
  400: "BAD_REQUEST",
  401: "UNAUTHORIZED",
  403: "FORBIDDEN",
  404: "NOT_FOUND",
  409: "CONFLICT",
  413: "PAYLOAD_TOO_LARGE",
  415: "UNSUPPORTED_MEDIA_TYPE",
  422: "UNPROCESSABLE_ENTITY",
  429: "TOO_MANY_REQUESTS",
}

export function toErrorShape(error: unknown): ErrorShape {
  if (error instanceof ZodError) {
    const details = toValidationIssues(error.issues)
    return {
      status: 422,
      code: "VALIDATION_ERROR",
      message: details[0] ? `${details[0].field}: ${details[0].message}` : "Validation failed",
      details,
    }
  }

  if (error instanceof HttpError) {
    return { status: error.status, code: error.code, message: error.message, details: error.details }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      const target = (error.meta?.target as string[] | string | undefined) ?? "field"
      return {
        status: 409,
        code: "CONFLICT",
        message: `Something with that ${Array.isArray(target) ? target.join(", ") : target} already exists`,
      }
    }
    if (error.code === "P2025") return { status: 404, code: "NOT_FOUND", message: "Not found" }
  }

  // Better Auth's APIError, body-parser errors, framework errors: anything with a 4xx status.
  const status = statusOf(error)
  if (status && status < 500) {
    const body = (error as { body?: { message?: string } }).body
    return {
      status,
      code: STATUS_CODES[status] ?? "HTTP_ERROR",
      message: body?.message ?? (error instanceof Error ? error.message : "Request failed"),
    }
  }

  return {
    status: 500,
    code: "INTERNAL_SERVER_ERROR",
    message:
      !isProduction && error instanceof Error
        ? error.message
        : "Something went wrong on our side. Please try again.",
  }
}

export function errorBody(shape: ErrorShape, request: RequestLike, error?: unknown): ApiErrorResponse {
  return {
    success: false,
    error: {
      code: shape.code,
      message: shape.message,
      statusCode: shape.status,
      ...(shape.details && { details: shape.details }),
      ...(!isProduction && shape.status >= 500 && error instanceof Error && { stack: error.stack }),
    },
    meta: meta(request),
  }
}

function statusOf(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined
  for (const key of ["statusCode", "status"]) {
    const value: unknown = Reflect.get(error, key)
    if (typeof value === "number" && value >= 400 && value < 600) return value
  }
  return undefined
}
