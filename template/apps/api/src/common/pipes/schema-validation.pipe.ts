import {
  HttpStatus,
  Injectable,
  StandardSchemaValidationPipe,
  UnprocessableEntityException,
} from "@nestjs/common"
import type { ValidationIssue } from "@repo/validators"

/**
 * Validates every `@Body({ schema })`, `@Query({ schema })` and
 * `@Param("id", { schema })` with the Zod schema you pass — the same schema
 * the web app uses for its forms. Failures become a 422 with per-field details:
 *
 *   { success: false, error: { code: "VALIDATION_ERROR", details: [{ field: "title", message: "…" }] } }
 */
@Injectable()
export class SchemaValidationPipe extends StandardSchemaValidationPipe {
  constructor() {
    super({
      errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
      exceptionFactory: (issues) => {
        const details: ValidationIssue[] = issues.map((issue) => ({
          field:
            issue.path
              ?.map((segment) =>
                typeof segment === "object" ? String(segment.key) : String(segment)
              )
              .join(".") || "root",
          message: issue.message,
        }))
        return new UnprocessableEntityException({
          code: "VALIDATION_ERROR",
          message: details[0]
            ? `${details[0].field}: ${details[0].message}`
            : "Validation failed",
          details,
        })
      },
    })
  }
}
