import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from "@nestjs/common"
import { HttpAdapterHost } from "@nestjs/core"
import { Prisma } from "@repo/db"
import { isProduction } from "@repo/env"
import { type ApiErrorResponse, toValidationIssues, type ValidationIssue } from "@repo/validators"
import { ZodSerializationException, ZodValidationException } from "nestjs-zod"

interface ErrorShape {
  status: number
  code: string
  message: string
  details?: ValidationIssue[]
}

type ZodLikeError = { issues?: Array<{ path: PropertyKey[]; message: string }>; message?: string }

/**
 * Every error leaves the API in the same shape (`ApiErrorResponse` from
 * @repo/validators), so the web client can handle them in one place.
 *
 *   ZodValidationException (nestjs-zod)    → 422 VALIDATION_ERROR + details[]
 *   ZodSerializationException (nestjs-zod) → 500, logged: a response broke its schema
 *   HttpException (NotFoundException, …)   → its status, code from the status name
 *   Prisma unique / not-found errors       → 409 CONFLICT / 404 NOT_FOUND
 *   Anything else                          → 500, logged, message hidden in prod
 *
 * Replies go through Nest's HTTP adapter, so it works on Express and Fastify alike.
 */
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger("Exceptions")

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const { httpAdapter } = this.adapterHost
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<{ id?: unknown }>()
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
        path: String(httpAdapter.getRequestUrl(ctx.getRequest())),
        method: String(httpAdapter.getRequestMethod(ctx.getRequest())),
        ...(request.id !== undefined && { requestId: String(request.id) }),
      },
    }

    httpAdapter.reply(ctx.getResponse(), body, error.status)
  }

  private toErrorShape(exception: unknown): ErrorShape {
    // A request body/query that doesn't match its DTO's schema.
    if (exception instanceof ZodValidationException) {
      const details = toValidationIssues((exception.getZodError() as ZodLikeError).issues ?? [])
      return {
        status: HttpStatus.UNPROCESSABLE_ENTITY,
        code: "VALIDATION_ERROR",
        message: details[0] ? `${details[0].field}: ${details[0].message}` : "Validation failed",
        details,
      }
    }

    // A response that doesn't match its @ZodSerializerDto — a bug on our side.
    if (exception instanceof ZodSerializationException) {
      const zodError = exception.getZodError() as ZodLikeError
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: "INTERNAL_SERVER_ERROR",
        message: isProduction
          ? "Something went wrong on our side. Please try again."
          : `The response didn't match its schema: ${zodError.message ?? "unknown issue"}`,
      }
    }

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
