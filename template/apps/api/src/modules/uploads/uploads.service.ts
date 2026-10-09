// klin:file uploads
import { randomUUID } from "node:crypto"
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3"
import { getSignedUrl } from "@aws-sdk/s3-request-presigner"
import { Injectable, Logger, type OnModuleInit } from "@nestjs/common"
import { env, isDevelopment } from "@repo/env"
import type { PresignUploadInput, PresignedUpload } from "@repo/validators"

const UPLOAD_URL_TTL = 5 * 60 // seconds the browser has to start the upload
const READ_URL_TTL = 60 * 60

/**
 * Direct-to-storage uploads with presigned URLs. Files never pass through the
 * API: the browser asks for a URL, then PUTs the file straight to S3 / R2 /
 * any S3-compatible store. Reads go through GET /api/uploads/file/<key>, which
 * redirects to a short-lived signed URL, so the bucket can stay private.
 */
@Injectable()
export class UploadsService implements OnModuleInit {
  private readonly logger = new Logger(UploadsService.name)

  private readonly s3 = new S3Client({
    region: env.S3_REGION,
    endpoint: env.S3_ENDPOINT,
    forcePathStyle: env.S3_FORCE_PATH_STYLE,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Browsers can't add the checksum headers newer SDKs sign by default.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
  })

  /** In development, create the bucket on the local storage container if it's missing. */
  async onModuleInit() {
    if (!isDevelopment) return
    try {
      await this.s3.send(new HeadBucketCommand({ Bucket: env.S3_BUCKET }))
    } catch {
      try {
        await this.s3.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }))
        this.logger.log(`Created bucket "${env.S3_BUCKET}"`)
      } catch (error) {
        this.logger.warn(
          `Storage isn't reachable at ${env.S3_ENDPOINT ?? "AWS"} — uploads won't work until it is (try \`pnpm db:up\`). ${(error as Error).message}`
        )
      }
    }
  }

  async presign(userId: string, input: PresignUploadInput): Promise<PresignedUpload> {
    const safeName = input.filename.toLowerCase().replace(/[^a-z0-9.]+/g, "-").slice(-80)
    const key = `${input.purpose ?? "attachment"}/${userId}/${randomUUID()}-${safeName}`

    const uploadUrl = await getSignedUrl(
      this.s3,
      new PutObjectCommand({
        Bucket: env.S3_BUCKET,
        Key: key,
        ContentType: input.contentType,
        ContentLength: input.size,
      }),
      { expiresIn: UPLOAD_URL_TTL }
    )

    return {
      uploadUrl,
      key,
      fileUrl: `/api/uploads/file/${key}`,
      headers: { "Content-Type": input.contentType },
      expiresIn: UPLOAD_URL_TTL,
    }
  }

  readUrl(key: string) {
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), {
      expiresIn: READ_URL_TTL,
    })
  }
}
