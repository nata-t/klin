// klin:file uploads
import { Body, Controller, Get, Header, Param, Post, Redirect } from "@nestjs/common"
import { ZodSerializerDto } from "nestjs-zod"
import { CurrentUser, Public } from "../../common"
import { PresignedUploadDto, PresignUploadDto } from "./uploads.dto"
import { UploadsService } from "./uploads.service"

@Controller("uploads")
export class UploadsController {
  constructor(private readonly uploads: UploadsService) {}

  /** POST /api/uploads/presign → { uploadUrl, key, fileUrl, headers } */
  @Post("presign")
  @ZodSerializerDto(PresignedUploadDto)
  presign(@CurrentUser("id") userId: string, @Body() input: PresignUploadDto) {
    return this.uploads.presign(userId, input)
  }

  /** GET /api/uploads/file/<key> → 302 to a short-lived signed URL. Public so <img> tags work. */
  @Get("file/*key")
  @Public()
  @Header("Cache-Control", "private, max-age=3000")
  @Redirect()
  async file(@Param("key") key: string | string[]) {
    const objectKey = Array.isArray(key) ? key.join("/") : key
    return { url: await this.uploads.readUrl(objectKey), statusCode: 302 }
  }
}
