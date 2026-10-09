import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadManifest, normalizeAnswers, type PackageManager } from "../src/engine/manifest"
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
