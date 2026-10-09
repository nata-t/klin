import { Logo } from "@/components/logo"
import { siteConfig } from "@/config/site"

export function PublicFooter() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6">
        <Logo className="text-foreground" />
        <p>
          © {new Date().getFullYear()} {siteConfig.name}. Built with{" "}
          <a href="https://github.com" className="underline-offset-4 hover:underline">
            klin
          </a>
          .
        </p>
      </div>
    </footer>
  )
}
