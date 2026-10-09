import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "?"
  )
}

export function UserAvatar({
  name,
  image,
  className,
}: {
  name: string
  image?: string | null
  className?: string
}) {
  return (
    <Avatar className={cn("size-8 rounded-lg", className)}>
      {image && <AvatarImage src={image} alt={name} />}
      <AvatarFallback className="rounded-lg bg-brand/15 text-xs font-semibold text-brand">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  )
}
