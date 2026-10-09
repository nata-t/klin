// klin:file uploads
import { Body, Controller, Get, Param, Post, Res } from "@nestjs/common"
import { type PresignUploadInput, presignedUploadSchema, presignUploadSchema } from "@repo/validators"
import type { Response } from "express"
import { CurrentUser, Public, ResponseSchema } from "../../common"
import { UploadsService } from "./uploads.service"

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** POST /api/uploads/presign → { uploadUrl, key, fileUrl, headers } */
  @Post("presign")
  @ResponseSchema(presignedUploadSchema)
  presign(
    @CurrentUser("id") userId: string,
    @Body({ schema: presignUploadSchema }) input: PresignUploadInput
  ) {
    return this.uploads.presign(userId, input)
  }

  /** GET /api/uploads/file/<key> → 302 to a short-lived signed URL. Public so <img> tags work. */
  @Get("file/*key")
  @Public()
  async file(@Param("key") key: string | string[], @Res() res: Response) {
    const objectKey = Array.isArray(key) ? key.join("/") : key
    res.setHeader("Cache-Control", "private, max-age=3000")
    res.redirect(302, await this.uploads.readUrl(objectKey))
  }
}
