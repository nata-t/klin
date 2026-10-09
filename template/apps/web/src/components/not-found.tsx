import { Link } from "@tanstack/react-router"
import { ArrowLeftIcon } from "lucide-react"
import { Button } from "@/components/ui/button"

export function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-1 items-center justify-center p-6">
      <div className="text-center">
        <p className="bg-linear-to-b from-brand to-brand/30 bg-clip-text text-8xl font-black tracking-tighter text-transparent">
          404
        </p>
        <h1 className="mt-2 text-xl font-semibold">This page swept itself away</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          The link might be broken, or the page may have moved.
        </p>
        <Button className="mt-6" variant="outline" render={<Link to="/" />}>
          <ArrowLeftIcon /> Back home
        </Button>
      </div>
    </div>
  )
}
