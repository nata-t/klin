import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from "@nestjs/common"
import { REDIRECT_METADATA } from "@nestjs/common/constants"
import type { ApiSuccessResponse, PaginationMeta } from "@repo/validators"
import { map, type Observable } from "rxjs"

/** The bits of a request the envelope needs — the same on Express and Fastify. */
type HttpRequest = { url: string; method: string; id?: unknown }

/**
 * Wraps every successful response in the standard envelope:
 *
 *   { success: true, data, meta: { timestamp, path, method, requestId, pagination? } }
 *
 * Controllers just return data. Paginated results (`{ items, pagination }`)
 * also get their pagination copied into `meta` for convenience. @Redirect()
 * handlers are left alone: Nest reads `{ url, statusCode }` from their result.
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle()
    if (Reflect.getMetadata(REDIRECT_METADATA, context.getHandler())) return next.handle()
    const request = context.switchToHttp().getRequest<HttpRequest>()

    return next.handle().pipe(
      map((data: unknown) => {
        if (data instanceof StreamableFile) return data
        const pagination = getPagination(data)
        const body: ApiSuccessResponse<unknown> = {
          success: true,
          data: data ?? null,
          meta: {
            timestamp: new Date().toISOString(),
            path: request.url,
            method: request.method,
            ...(request.id !== undefined && { requestId: String(request.id) }),
            ...(pagination && { pagination }),
          },
        }
        return body
      })
    )
  }
}

function getPagination(data: unknown): PaginationMeta | undefined {
  if (typeof data !== "object" || data === null || !("pagination" in data)) return undefined
  const pagination = (data as { pagination: unknown }).pagination
  return typeof pagination === "object" && pagination !== null ? (pagination as PaginationMeta) : undefined
}
