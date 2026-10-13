// klin:file uploads
import { presignedUploadSchema, presignUploadSchema } from "@repo/validators"
import { createZodDto } from "nestjs-zod"

export class PresignUploadDto extends createZodDto(presignUploadSchema) {}
export class PresignedUploadDto extends createZodDto(presignedUploadSchema) {}
