import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadManifest, type Manifest, normalizeAnswers, type PackageManager } from "../src/engine/manifest"
import { render } from "../src/engine/render"
import { generateEnv, mergeEnv, parseEnv } from "../src/utils/env-file"

const templateDir = resolve(import.meta.dirname, "../../../template")
const manifest = loadManifest(templateDir)

async function renderPreset(preset: string, pm: PackageManager = "pnpm", overrides = {}) {
  const { answers } = normalizeAnswers(manifest, { ...manifest.presets![preset]!.answers, ...overrides })
  return render({ templateDir, manifest, answers, pm, pmVersion: "1.0.0", name: "Test App" })
}

const text = (files: Awaited<ReturnType<typeof renderPreset>>, path: string) => files.get(path)?.content.toString() ?? ""

describe("template rendering", () => {
  it("renders every preset × package manager without leftover markers", async () => {
    for (const preset of Object.keys(manifest.presets!)) {
      for (const pm of ["pnpm", "bun", "npm"] as const) {
        const files = await renderPreset(preset, pm)
        for (const [path, file] of files) {
          if (Buffer.isBuffer(file.content)) continue
          expect(file.content, `${preset}/${pm}: ${path}`).not.toMatch(/klin:(if|elif|else|endif|file|only)\b/)
          expect(file.content, `${preset}/${pm}: ${path}`).not.toMatch(/^\s*(\/\/|#)\? /m)
        }
      }
    }
  })

  it("renders every backend × server × security combination cleanly", async () => {
    for (const backend of ["nest", "plain"]) {
      for (const server of ["express", "fastify"]) {
        for (const security of [["cors", "helmet", "rate-limit"], []]) {
          for (const components of ["apps-web", "packages-ui"]) {
            const label = `${backend}/${server}/${security.length ? "secure" : "bare"}/${components}`
            const files = await renderPreset("everything", "pnpm", { backend, server, security, components })
            for (const [path, file] of files) {
              if (Buffer.isBuffer(file.content)) continue
              expect(file.content, `${label}: ${path}`).not.toMatch(/klin:(if|elif|else|endif|file|only)\b/)
              expect(file.content, `${label}: ${path}`).not.toMatch(/^\s*(\/\/|#)\? /m)
              expect(path, label).not.toMatch(/^(variants\/|apps\/api\/plain)/)
            }
            expect(files.has("apps/api/src/main.ts"), label).toBe(true)
            expect(files.has("apps/api/src/seed.ts"), label).toBe(true)
          }
        }
      }
    }
  })

  it("builds the web app with Next.js instead of Vite, for every backend and component home", async () => {
    for (const backend of ["nest", "plain"]) {
      for (const components of ["apps-web", "packages-ui"]) {
        for (const extras of [["email", "i18n", "docker", "ci"], []]) {
          const label = `next/${backend}/${components}/${extras.length ? "extras" : "bare"}`
          const files = await renderPreset("everything", "pnpm", { web: "next", backend, components, extras })
          for (const [path, file] of files) {
            if (Buffer.isBuffer(file.content)) continue
            expect(file.content, `${label}: ${path}`).not.toMatch(/klin:(if|elif|else|endif|file|only)\b/)
            expect(file.content, `${label}: ${path}`).not.toMatch(/^\s*(\/\/|#)\? /m)
            expect(file.content, `${label}: ${path}`).not.toMatch(/@tanstack\/react-router|import\.meta\.env/)
            expect(path, label).not.toMatch(/^(variants\/|apps\/web\/src\/routes\/)/)
          }
          for (const path of ["apps/web/vite.config.ts", "apps/web/index.html", "apps/web/src/main.tsx", "apps/web/tsconfig.node.json"]) {
            expect(files.has(path), `${label}: ${path}`).toBe(false)
          }
          expect(files.has("apps/web/src/app/(app)/layout.tsx"), label).toBe(true)
          expect(files.has("apps/web/src/proxy.ts"), label).toBe(true)
          const web = JSON.parse(text(files, "apps/web/package.json"))
          expect(web.dependencies, label).toHaveProperty("next")
          expect(web.devDependencies, label).not.toHaveProperty("vite")
          expect(web.scripts.typecheck, label).toBe("next typegen && tsc --noEmit")
          expect(JSON.parse(text(files, "apps/web/components.json")).rsc, label).toBe(true)
          expect(JSON.parse(text(files, "packages/eslint-config/package.json")).exports, label).toHaveProperty("./next")
          expect(files.has("apps/web/src/i18n/client.ts"), label).toBe(extras.includes("i18n"))
          expect(files.has("apps/web/nginx/default.conf.template"), label).toBe(extras.includes("docker"))
          const ui = components === "packages-ui" ? "packages/ui/src/components" : "apps/web/src/components/ui"
          expect(text(files, `${ui}/dialog.tsx`), label).toMatch(/^"use client"\n\n/)
          expect(text(files, `${ui}/button.tsx`), label).not.toContain("use client")
        }
      }
    }
  })

  it("keeps Next.js out of a Vite project, and the web framework fixed after create", async () => {
    const files = await renderPreset("everything")
    expect([...files.keys()].some((path) => path.startsWith("apps/web/src/app/") || path.startsWith("variants/"))).toBe(false)
    expect(files.has("packages/eslint-config/next.js")).toBe(false)
    expect(files.has("packages/typescript-config/next.json")).toBe(false)
    const eslint = JSON.parse(text(files, "packages/eslint-config/package.json"))
    expect(eslint.dependencies).not.toHaveProperty("@next/eslint-plugin-next")
    expect(eslint.exports).not.toHaveProperty("./next")
    expect(JSON.parse(text(files, "turbo.json")).tasks.build.env).toEqual(["VITE_*"])
    expect(JSON.parse(text(files, "apps/web/components.json")).rsc).toBe(false)
    expect(text(files, "apps/web/src/components/ui/dialog.tsx")).not.toContain("use client")
    expect(manifest.questions.find((q) => q.id === "web")).toMatchObject({ default: "vite", locked: true })
  })

  it("wires NestJS with nestjs-zod on the chosen HTTP server", async () => {
    for (const server of ["express", "fastify"] as const) {
      const files = await renderPreset("recommended", "pnpm", { server })
      const api = JSON.parse(text(files, "apps/api/package.json"))
      expect(api.dependencies).toHaveProperty("nestjs-zod")
      expect(api.dependencies).toHaveProperty(`@nestjs/platform-${server}`)
      expect(api.dependencies).not.toHaveProperty(`@nestjs/platform-${server === "express" ? "fastify" : "express"}`)
      expect(api.dependencies).not.toHaveProperty("express-rate-limit")
      expect(text(files, "apps/api/src/app.module.ts")).toContain("ZodValidationPipe")
      expect(text(files, "apps/api/src/modules/notes/notes.dto.ts")).toContain("createZodDto(createNoteSchema)")
      expect(text(files, "apps/api/src/main.ts")).toContain(server === "fastify" ? "FastifyAdapter" : "NestExpressApplication")
    }
  })

  it("builds plain Express and Fastify APIs from the shared code", async () => {
    const express = await renderPreset("recommended", "pnpm", { backend: "plain", server: "express" })
    const fastify = await renderPreset("recommended", "pnpm", { backend: "plain", server: "fastify" })
    for (const files of [express, fastify]) {
      const api = JSON.parse(text(files, "apps/api/package.json"))
      expect(Object.keys(api.dependencies).filter((d) => d.startsWith("@nestjs/") || d.includes("nestjs"))).toEqual([])
      expect(files.has("apps/api/src/services/notes.ts")).toBe(true)
      expect(files.has("apps/api/src/app.module.ts")).toBe(false)
      expect(text(files, "apps/api/tsconfig.json")).toContain("node.json")
    }
    expect(JSON.parse(text(express, "apps/api/package.json")).dependencies).toHaveProperty("express")
    expect(text(express, "apps/api/src/app.ts")).toContain("toNodeHandler(auth)")
    expect(JSON.parse(text(fastify, "apps/api/package.json")).dependencies).toHaveProperty("fastify")
    expect(text(fastify, "apps/api/src/routes/notes.ts")).toContain("schema: { body: createNoteSchema }")
  })

  it("switches CORS, Helmet and rate limiting on and off", async () => {
    for (const [backend, server] of [["nest", "express"], ["nest", "fastify"], ["plain", "express"], ["plain", "fastify"]]) {
      const off = await renderPreset("recommended", "pnpm", { backend, server, security: [] })
      const entry = backend === "nest" ? "apps/api/src/main.ts" : "apps/api/src/app.ts"
      expect(text(off, entry)).not.toMatch(/helmet|Helmet|enableCors|cors\(|RateLimit|rateLimit/)
      expect(text(off, "apps/api/package.json")).not.toMatch(/"helmet"|@fastify\/helmet|@nestjs\/throttler|express-rate-limit|@fastify\/rate-limit/)
      const on = await renderPreset("recommended", "pnpm", { backend, server })
      expect(text(on, entry)).toMatch(/helmet|Helmet/)
    }
  })

  it("moves shadcn/ui into packages/ui and rewrites imports", async () => {
    for (const pm of ["pnpm", "npm"] as const) {
      const files = await renderPreset("everything", pm, { components: "packages-ui" })
      expect(files.has("packages/ui/src/components/button.tsx")).toBe(true)
      expect(files.has("packages/ui/src/styles/globals.css")).toBe(true)
      expect([...files.keys()].some((path) => path.startsWith("apps/web/src/components/ui/"))).toBe(false)
      for (const [path, file] of files) {
        if (!/^(apps\/web|packages\/ui)\/.*\.tsx?$/.test(path)) continue
        expect(file.content.toString(), path).not.toMatch(/"@\/components\/ui\/|"@\/lib\/utils"|"@\/hooks\/use-mobile"|"\.\/theme-provider"/)
      }
      const web = JSON.parse(text(files, "apps/web/package.json"))
      expect(web.dependencies["@repo/ui"]).toBe(pm === "npm" ? "*" : "workspace:*")
      expect(JSON.parse(text(files, "apps/web/components.json")).aliases.ui).toBe("@repo/ui/components")
      expect(JSON.parse(text(files, "packages/ui/components.json")).aliases.utils).toBe("@repo/ui/lib/utils")
      expect(text(files, "apps/web/src/main.tsx")).toContain('import "@repo/ui/globals.css"')
    }
  })

  it("themes with shadcn's colors, Turborepo's TUI and English-only i18n", async () => {
    const files = await renderPreset("everything", "pnpm", { accent: "blue" })
    expect(text(files, "apps/web/src/styles.css")).toContain("--brand: oklch(0.488 0.243 264.376);")
    expect(text(files, "apps/web/src/styles.css")).toContain("--brand: oklch(0.424 0.199 265.638);")
    expect(JSON.parse(text(files, "turbo.json")).ui).toBe("tui")
    expect([...files.keys()].filter((path) => path.includes("i18n/locales/"))).toEqual(["apps/web/src/i18n/locales/en.json"])
    expect(manifest.questions.find((q) => q.id === "accent")!.options[0]).toBe("neutral")
  })

  it("starts Prisma Studio with `turbo run dev` without ever failing it", async () => {
    const files = await renderPreset("recommended")
    const studio = JSON.parse(text(files, "packages/db/package.json")).scripts.dev as string
    expect(studio).toMatch(/^prisma studio --port 5555 --browser none \|\| prisma studio --browser none \|\| /)
    expect(JSON.parse(text(files, "turbo.json")).tasks["db:studio"]).toEqual({ cache: false, persistent: true })
    expect(files.has("packages/db/data/.gitkeep")).toBe(false)
  })

  it("adds the nestjs-zod override for npm only", async () => {
    expect(JSON.parse(text(await renderPreset("recommended", "npm"), "package.json")).overrides).toHaveProperty("nestjs-zod")
    expect(JSON.parse(text(await renderPreset("recommended", "pnpm"), "package.json")).overrides).toBeUndefined()
    expect(JSON.parse(text(await renderPreset("recommended", "npm", { backend: "plain" }), "package.json")).overrides).toBeUndefined()
  })

  it("replaces project tokens", async () => {
    const files = await renderPreset("recommended")
    expect(JSON.parse(text(files, "package.json")).name).toBe("test-app")
    expect(text(files, "apps/web/src/config/site.ts")).toContain('name: "Test App"')
    expect(text(files, ".env.example")).toContain("POSTGRES_DB=test_app")
  })

  it("strips unselected modules", async () => {
    const files = await renderPreset("minimal")
    expect(files.has("packages/email/package.json")).toBe(false)
    expect(files.has("apps/api/src/modules/admin/admin.controller.ts")).toBe(false)
    expect(files.has("docker-compose.yml")).toBe(false)
    expect(files.has(".github/workflows/ci.yml")).toBe(false)
    const api = JSON.parse(text(files, "apps/api/package.json"))
    expect(api.dependencies).not.toHaveProperty("bullmq")
    expect(api.dependencies).not.toHaveProperty("@prisma/adapter-pg")
    expect(api.dependencies).toHaveProperty("@prisma/adapter-better-sqlite3")
    expect(text(files, "packages/db/prisma/schema.prisma")).toContain('provider = "sqlite"')
    expect(files.has("packages/db/data/.gitkeep")).toBe(true)
    expect(text(files, "packages/auth/src/auth.ts")).not.toContain("organization(")
  })

  it("adapts commands and workspaces to the package manager", async () => {
    const npm = await renderPreset("recommended", "npm")
    const pkg = JSON.parse(text(npm, "package.json"))
    expect(pkg.workspaces).toEqual(["apps/*", "packages/*"])
    expect(pkg.scripts["db:migrate"]).toBe("npm --prefix packages/db run db:migrate")
    expect(JSON.parse(text(npm, "apps/api/package.json")).dependencies["@repo/db"]).toBe("*")
    expect(npm.has("pnpm-workspace.yaml")).toBe(false)
    expect(text(npm, ".husky/pre-commit")).toBe("npx --no -- lint-staged\n")

    const pnpm = await renderPreset("recommended", "pnpm")
    expect(JSON.parse(text(pnpm, "package.json")).workspaces).toBeUndefined()
    expect(pnpm.has("pnpm-workspace.yaml")).toBe(true)
  })

  it("picks the right Prisma provider and adapter per database", async () => {
    for (const [db, provider, adapter] of [
      ["postgres", "postgresql", "PrismaPg"],
      ["mysql", "mysql", "PrismaMariaDb"],
      ["sqlite", "sqlite", "PrismaBetterSqlite3"],
    ] as const) {
      const files = await renderPreset("recommended", "pnpm", { database: db })
      expect(text(files, "packages/db/prisma/schema.prisma")).toContain(`provider = "${provider}"`)
      expect(text(files, "packages/db/src/client.ts")).toContain(adapter)
    }
  })
})

describe("rules: move, replace, merge", () => {
  function fakeTemplate(files: Record<string, string>, rules: Manifest["rules"]) {
    const dir = mkdtempSync(join(tmpdir(), "klin-test-"))
    for (const [path, content] of Object.entries(files)) {
      mkdirSync(dirname(join(dir, path)), { recursive: true })
      writeFileSync(join(dir, path), content)
    }
    const fake: Manifest = {
      name: "fake",
      tokens: {},
      questions: [{ id: "mode", type: "select", options: ["a", "b"], default: "a", message: "?" }],
      options: { a: { label: "A" }, b: { label: "B" } },
      rules,
    }
    writeFileSync(join(dir, "klin.template.json"), JSON.stringify(fake))
    return { dir, fake }
  }

  it("moves folders and files, rewrites text and merges JSON", async () => {
    const { dir, fake } = fakeTemplate(
      {
        "src/a.ts": 'import x from "@/old/x"\n',
        "alt/b.ts": "b\n",
        "pkg/package.json": '{ "name": "pkg", "dependencies": { "z": "1" } }\n',
      },
      [
        {
          when: "b",
          move: { "alt/": "src/", "src/a.ts": "lib/a.ts" },
          replace: [{ files: "lib/**", from: '"@/old/', to: '"@new/' }],
          merge: { "pkg/package.json": { dependencies: { a: "2" } } },
        },
      ]
    )
    const files = await render({ templateDir: dir, manifest: fake, answers: { mode: "b" }, pm: "pnpm", pmVersion: "1", name: "x" })
    expect([...files.keys()].sort()).toEqual(["lib/a.ts", "pkg/package.json", "src/b.ts"])
    expect(text(files, "lib/a.ts")).toBe('import x from "@new/x"\n')
    expect(Object.keys(JSON.parse(text(files, "pkg/package.json")).dependencies)).toEqual(["a", "z"])
  })

  it("refuses two files rendering to the same path", async () => {
    const { dir, fake } = fakeTemplate({ "src/a.ts": "1\n", "alt/a.ts": "2\n" }, [{ when: "b", move: { "alt/": "src/" } }])
    await expect(
      render({ templateDir: dir, manifest: fake, answers: { mode: "b" }, pm: "pnpm", pmVersion: "1", name: "x" })
    ).rejects.toThrow(/both render to src\/a\.ts/)
  })
})

describe(".env generation", () => {
  const example = "SECRET=change-me\nPASSWORD=pw123\nURL=postgres://u:pw123@localhost/db\n# comment pw123\n"

  it("generates secrets and keeps related values in sync", () => {
    const env = parseEnv(generateEnv(example, { SECRET: "secret", PASSWORD: "password" }))
    expect(env.get("SECRET")).not.toBe("change-me")
    expect(env.get("SECRET")!.length).toBeGreaterThanOrEqual(40)
    expect(env.get("URL")).toBe(`postgres://u:${env.get("PASSWORD")}@localhost/db`)
  })

  it("appends only missing keys", () => {
    const { text: merged, added } = mergeEnv("SECRET=mine\n", example + "NEW_KEY=1\n", {})
    expect(added).toEqual(["PASSWORD", "URL", "NEW_KEY"])
    expect(parseEnv(merged).get("SECRET")).toBe("mine")
  })
})
