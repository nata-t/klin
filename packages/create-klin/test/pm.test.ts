import { describe, expect, it } from "vitest"
import { rewriteCommand, rewriteMarkdown } from "../src/utils/pm"
import { pluralize, kebab, pascal, camel, snake, title } from "../src/utils/names"

describe("package manager rewrites", () => {
  it("leaves pnpm commands alone for pnpm", () => {
    expect(rewriteCommand("pnpm dev", "pnpm")).toBe("pnpm dev")
  })

  it("rewrites scripts, exec and dir-scoped runs", () => {
    expect(rewriteCommand("pnpm dev", "npm")).toBe("npm run dev")
    expect(rewriteCommand("pnpm dev", "bun")).toBe("bun run dev")
    expect(rewriteCommand("pnpm exec lint-staged", "bun")).toBe("bunx lint-staged")
    expect(rewriteCommand("pnpm exec lint-staged", "npm")).toBe("npx --no -- lint-staged")
    expect(rewriteCommand("pnpm --dir packages/db run db:migrate", "npm")).toBe(
      "npm --prefix packages/db run db:migrate"
    )
    expect(rewriteCommand("pnpm --dir packages/db run db:migrate", "bun")).toBe(
      "bun run --cwd packages/db db:migrate"
    )
    expect(rewriteCommand("pnpm build && pnpm exec playwright test", "npm")).toBe(
      "npm run build && npx --no -- playwright test"
    )
    expect(rewriteCommand("pnpm klin add email --yes", "npm")).toBe("npm run klin -- add email --yes")
    expect(rewriteCommand("pnpm turbo run build --filter=@repo/api", "npm")).toBe("npx --no -- turbo run build --filter=@repo/api")
    expect(rewriteCommand("pnpm --dir apps/web exec playwright install", "bun")).toBe("cd apps/web && bunx playwright install")
    expect(rewriteCommand("pnpm --dir apps/web exec playwright install", "npm")).toBe(
      "cd apps/web && npx --no -- playwright install"
    )
  })

  it("does not touch file names that contain pnpm", () => {
    expect(rewriteCommand("cat pnpm-lock.yaml pnpm-workspace.yaml", "npm")).toBe(
      "cat pnpm-lock.yaml pnpm-workspace.yaml"
    )
    expect(rewriteCommand("uses: pnpm/action-setup@v4", "npm")).toBe("uses: pnpm/action-setup@v4")
  })

  it("rewrites markdown code only", () => {
    const md = ["Use pnpm workspaces.", "", "```bash", "pnpm install", "pnpm db:up", "```", "Run `pnpm dev`."].join("\n")
    expect(rewriteMarkdown(md, "bun")).toBe(
      ["Use pnpm workspaces.", "", "```bash", "bun install", "bun run db:up", "```", "Run `bun run dev`."].join("\n")
    )
  })
})

describe("names", () => {
  it("converts cases", () => {
    expect(kebab("BlogPost")).toBe("blog-post")
    expect(pascal("blog-post")).toBe("BlogPost")
    expect(camel("blog_post")).toBe("blogPost")
    expect(snake("blogPost")).toBe("blog_post")
    expect(title("my-cool-app")).toBe("My Cool App")
  })

  it("pluralizes", () => {
    expect(pluralize("note")).toBe("notes")
    expect(pluralize("category")).toBe("categories")
    expect(pluralize("box")).toBe("boxes")
    expect(pluralize("person")).toBe("people")
    expect(pluralize("day")).toBe("days")
  })
})
