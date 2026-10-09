import { IMAGE_TYPES, MAX_AVATAR_MB } from "@repo/validators"
import { CameraIcon } from "lucide-react"
import { useRef } from "react"
import { toast } from "sonner"
import { UserAvatar } from "@/components/layout/user-avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { authClient } from "@/lib/auth-client"
import { errorMessage } from "@/lib/api-error"
import { refreshSession, useCurrentUser } from "@/lib/session"
import { useFileUpload } from "./use-file-upload"

export function AvatarUpload() {
  const user = useCurrentUser()
  const input = useRef<HTMLInputElement>(null)
  const { upload, progress, uploading } = useFileUpload()

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!IMAGE_TYPES.includes(file.type as (typeof IMAGE_TYPES)[number]) || file.size > MAX_AVATAR_MB * 1024 * 1024) {
      toast.error(`Pick a PNG, JPG, WEBP or GIF up to ${MAX_AVATAR_MB}MB`)
      return
    }
    try {
      const { fileUrl } = await upload(file, "avatar")
      const { error } = await authClient.updateUser({ image: fileUrl })
      if (error) throw new Error(error.message)
      await refreshSession()
      toast.success("Looking good! Avatar updated.")
    } catch (error) {
      toast.error(errorMessage(error, "Couldn't upload your avatar"))
    } finally {
      if (input.current) input.current.value = ""
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <UserAvatar name={user.name} image={user.image} className="size-16 text-lg" />
        {uploading && (
          <div className="absolute inset-0 grid place-items-center rounded-lg bg-background/70 text-xs font-medium">
            {progress ? `${progress}%` : <Spinner />}
          </div>
        )}
      </div>
      <div className="space-y-1">
        <Button variant="outline" size="sm" disabled={uploading} onClick={() => input.current?.click()}>
          <CameraIcon /> Change avatar
        </Button>
        <p className="text-xs text-muted-foreground">PNG, JPG, WEBP or GIF · up to {MAX_AVATAR_MB}MB</p>
      </div>
      <input
        ref={input}
        type="file"
        accept={IMAGE_TYPES.join(",")}
        className="hidden"
        onChange={(event) => void onFile(event.target.files?.[0])}
      />
    </div>
  )
}
