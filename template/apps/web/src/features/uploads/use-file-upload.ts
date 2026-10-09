import type { PresignedUpload, UploadPurpose } from "@repo/validators"
import { useState } from "react"
import { api } from "@/lib/api-client"

/**
 * Upload a file straight to S3/R2: ask the API for a presigned URL, then PUT
 * the bytes directly to storage (with progress). Returns the stored file's
 * `key` (save it) and `fileUrl` (show it).
 */
export function useFileUpload() {
  const [progress, setProgress] = useState<number | null>(null)

  async function upload(file: File, purpose: UploadPurpose = "attachment") {
    setProgress(0)
    try {
      const presigned = await api.post<PresignedUpload>("/uploads/presign", {
        filename: file.name,
        contentType: file.type || "application/octet-stream",
        size: file.size,
        purpose,
      })
      await putWithProgress(presigned, file, setProgress)
      return presigned
    } finally {
      setProgress(null)
    }
  }

  return { upload, progress, uploading: progress !== null }
}

function putWithProgress(presigned: PresignedUpload, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open("PUT", presigned.uploadUrl)
    for (const [name, value] of Object.entries(presigned.headers)) xhr.setRequestHeader(name, value)
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`))
    xhr.onerror = () =>
      reject(new Error("Upload failed. If this keeps happening, check your bucket's CORS settings."))
    xhr.send(file)
  })
}
