import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { Prisma } from "@repo/db"
import { isProduction } from "@repo/env"
import type { ApiErrorResponse, ValidationIssue } from "@repo/validators"
import type { Request, Response } from "express"

interface ErrorShape {
  status: number
  code: string
  message: string
  details?: ValidationIssue[]
}

/**
 * Every error leaves the API in the same shape (`ApiErrorResponse` from
 * @repo/validators), so the web client can handle them in one place.
 *
 *   HttpException (NotFoundException, …)  → its status, code from the status name
 *   Validation failures                   → 422 VALIDATION_ERROR + details[]
 *   Prisma unique / not-found errors      → 409 CONFLICT / 404 NOT_FOUND
 *   Anything else                         → 500, logged, message hidden in prod
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions")

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp()
    const response = ctx.getResponse<Response>()
    const request = ctx.getRequest<Request & { id?: string }>()

    if (response.headersSent) return

    const error = this.toErrorShape(exception)

    if (error.status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack ?? exception.message : String(exception)
      )
    }

    const body: ApiErrorResponse = {
      success: false,
      error: {
        code: error.code,
        message: error.message,
        statusCode: error.status,
        ...(error.details && { details: error.details }),
        ...(!isProduction &&
          error.status >= 500 &&
          exception instanceof Error && { stack: exception.stack }),
      },
      meta: {
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(request.id && { requestId: String(request.id) }),
      },
    }

    response.status(error.status).json(body)
  }

  private toErrorShape(exception: unknown): ErrorShape {
    if (exception instanceof HttpException) {
      const status = exception.getStatus()
      const res = exception.getResponse()
      const payload = typeof res === "object" && res !== null ? (res as Record<string, unknown>) : {}
      const message =
        typeof res === "string"
          ? res
          : Array.isArray(payload.message)
            ? payload.message.join("; ")
            : typeof payload.message === "string"
              ? payload.message
              : exception.message
      return {
        status,
        code: typeof payload.code === "string" ? payload.code : (HttpStatus[status] ?? "HTTP_ERROR"),
        message,
        details: Array.isArray(payload.details) ? (payload.details as ValidationIssue[]) : undefined,
      }
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      if (exception.code === "P2002") {
        const target = (exception.meta?.target as string[] | string | undefined) ?? "field"
        return {
          status: HttpStatus.CONFLICT,
          code: "CONFLICT",
          message: `Something with that ${Array.isArray(target) ? target.join(", ") : target} already exists`,
        }
      }
      if (exception.code === "P2025") {
        return { status: HttpStatus.NOT_FOUND, code: "NOT_FOUND", message: "Not found" }
      }
    }

    // Better Auth APIError (thrown by auth.api.* calls) and similar objects.
    if (isStatusError(exception)) {
      return {
        status: exception.statusCode,
        code: HttpStatus[exception.statusCode] ?? "HTTP_ERROR",
        message: exception.body?.message ?? exception.message,
      }
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: "INTERNAL_SERVER_ERROR",
      message:
        !isProduction && exception instanceof Error
          ? exception.message
          : "Something went wrong on our side. Please try again.",
    }
  }
}

function isStatusError(
  value: unknown
): value is Error & { statusCode: number; body?: { message?: string } } {
  if (!(value instanceof Error)) return false
  const statusCode: unknown = Reflect.get(value, "statusCode")
  return typeof statusCode === "number" && statusCode >= 400
}
