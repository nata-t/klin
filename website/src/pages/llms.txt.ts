import type { APIRoute } from "astro"
import { getCollection } from "astro:content"

/**
 * /llms.txt — the docs as one plain-text file, for AI assistants (klin
 * projects ship an AGENTS.md, and the people using them work with assistants).
 * MDX components are dropped; the prose and code blocks stay.
 */

const ORDER = [
  "docs",
  "docs/getting-started",
  "docs/create/wizard",
  "docs/create/presets",
  "docs/create/choosing-your-stack",
  "docs/project/layout",
  "docs/project/shared-schemas",
  "docs/project/scripts",
  "docs/project/environment",
  "docs/project/deploying",
  "docs/grow/generate",
  "docs/grow/add-remove",
  "docs/grow/doctor",
  "docs/grow/upgrade",
  "docs/reference/cli",
  "docs/reference/klin-json",
  "docs/reference/custom-templates",
  "docs/troubleshooting",
]

const clean = (body: string) =>
  body
    .replace(/^import .*$/gm, "")
    .replace(/<\/?(Tabs|TabItem|Steps|Aside|CardGrid|Card|LinkCard|FileTree)[^>]*>/g, "")
    .replace(/^<[A-Z]\w*[^>]*\/>$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()

export const GET: APIRoute = async () => {
  const docs = await getCollection("docs")
  const byId = new Map(docs.map((d) => [d.id, d]))
  const sections = ORDER.flatMap((id) => {
    const doc = byId.get(id)
    if (!doc) return []
    return [`# ${doc.data.title}\n\n${doc.data.description ?? ""}\n\n${clean(doc.body ?? "")}`]
  })
  const head = [
    "# klin",
    "",
    "> A full-stack TypeScript starter: `npm create klin@latest` makes a monorepo with an API (NestJS or plain Express/Fastify), a web app (Vite + TanStack Router or Next.js), Better Auth, Prisma and one set of Zod schemas shared by both; the `klin` CLI then generates features and switches modules on and off inside the project.",
    "",
    "Options and modules are listed at /docs/reference/options/ (generated from the template's manifest).",
    "",
  ].join("\n")
  return new Response(`${head}\n${sections.join("\n\n---\n\n")}\n`, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
