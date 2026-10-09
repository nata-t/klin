import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  StreamableFile,
} from "@nestjs/common"
import type { ApiSuccessResponse, PaginationMeta } from "@repo/validators"
import type { Request } from "express"
import { map, type Observable } from "rxjs"

/**
 * Wraps every successful response in the standard envelope:
 *
 *   { success: true, data, meta: { timestamp, path, method, requestId, pagination? } }
 *
 * Controllers just return data. Paginated results (`{ items, pagination }`)
 * also get their pagination copied into `meta` for convenience.
 */
@Injectable()
export class ApiResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== "http") return next.handle()
    const request = context.switchToHttp().getRequest<Request & { id?: string }>()

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
            ...(request.id && { requestId: String(request.id) }),
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
