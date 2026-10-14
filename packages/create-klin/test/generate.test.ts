import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadManifest, normalizeAnswers } from "../src/engine/manifest"
import { render } from "../src/engine/render"
import { defaultDirs, parseDir, projectDirs, withDirs } from "../src/generators/dirs"
import { type GenerateOptions, type Plan, PlanError, planGenerate, type Project, type Reader } from "../src/generators/plan"
import { type GenKind, parseTarget, resolveKind, type TargetOverrides } from "../src/generators/target"
import { singularize } from "../src/utils/names"

const templateDir = resolve(import.meta.dirname, "../../../template")
const manifest = loadManifest(templateDir)

/** A rendered project held in memory, readable like the disk and updatable with a plan. */
async function project(overrides: Record<string, string | string[]> = {}) {
  const { answers } = normalizeAnswers(manifest, { ...manifest.presets!.recommended!.answers, ...overrides })
  const rendered = await render({ templateDir, manifest, answers, pm: "bun", pmVersion: "1.0.0", name: "Test App" })
  const files = new Map<string, string>()
  for (const [path, file] of rendered) if (typeof file.content === "string") files.set(path, file.content)
  const fs: Reader = {
    read: (path) => files.get(path) ?? null,
    exists: (path) => files.has(path) || [...files.keys()].some((p) => p.startsWith(`${path}/`)),
    files: (dir) => [...files.keys()].filter((p) => p.startsWith(`${dir}/`)),
  }
  const info: Project = {
    backend: answers.backend === "plain" ? "plain" : "nest",
    server: answers.server === "fastify" ? "fastify" : "express",
    web: answers.web === "next" ? "next" : "vite",
    packagesUi: answers.components === "packages-ui",
    pm: "bun",
  }
  const plan = (kind: GenKind, name: string, flags: GenerateOptions & TargetOverrides = {}) =>
    planGenerate(kind, parseTarget(name, { plural: flags.plural, url: flags.url }), info, fs, flags)
  const apply = (result: Plan) => {
    for (const edit of result.edits) if (edit.content !== undefined) files.set(edit.path, edit.content)
    return result
  }
  return { files, plan, apply }
}

const byPath = (plan: Plan) => new Map(plan.edits.map((edit) => [edit.path, edit]))

describe("generate: names", () => {
  it("splits organization folders from the name", () => {
    const t = parseTarget("/loan/payment/")
    expect(t.path).toBe("loan/payment")
    expect(t.folders).toEqual(["loan"])
    expect(t.leaf.pascal).toBe("Payment")
    expect(t.one.pascal).toBe("Payment")
    expect(t.many.title).toBe("Payments")
    expect(t.list.camel).toBe("payments")
  })

  it("keeps the name as typed for folders and singularizes it for schemas", () => {
    const t = parseTarget("billing/loanPayments")
    expect(t.path).toBe("billing/loan-payments")
    expect(t.leaf.pascal).toBe("LoanPayments")
    expect(t.one.pascal).toBe("LoanPayment")
    expect(t.list.pascal).toBe("LoanPayments")
  })

  it("names lists apart when singular and plural are the same word", () => {
    const t = parseTarget("feedback")
    expect(t.one.camel).toBe("feedback")
    expect(t.list.camel).toBe("feedbackList")
  })

  it("rejects bad names", () => {
    expect(() => parseTarget("")).toThrow(/name/)
    expect(() => parseTarget("loan/9lives")).toThrow(/valid name/)
    expect(() => parseTarget("loan/../payment")).toThrow(/valid name/)
    expect(() => parseTarget("class")).toThrow(/reserved/)
  })

  it("singularizes common words", () => {
    const cases: Record<string, string> = {
      payments: "payment",
      categories: "category",
      addresses: "address",
      boxes: "box",
      courses: "course",
      movies: "movie",
      statuses: "status",
      status: "status",
      people: "person",
      news: "news",
      payment: "payment",
    }
    for (const [plural, singular] of Object.entries(cases)) expect(singularize(plural), plural).toBe(singular)
  })

  it("understands the kinds and their aliases", () => {
    expect(resolveKind("r")).toBe("resource")
    expect(resolveKind("api")).toBe("backend")
    expect(resolveKind("module")).toBe("backend")
    expect(resolveKind("web")).toBe("frontend")
    expect(resolveKind("FEATURE")).toBe("frontend")
    expect(resolveKind("page-object")).toBeUndefined()
  })
})

describe("generate: NestJS", () => {
  it("wires a full-stack resource through every layer, in nested folders", async () => {
    const { plan } = await project()
    const edits = byPath(plan("resource", "loan/payment"))
    const content = (path: string) => edits.get(path)?.content ?? ""

    expect([...edits.keys()].sort()).toEqual([
      "apps/api/src/app.module.ts",
      "apps/api/src/modules/loan/payment/payment.controller.ts",
      "apps/api/src/modules/loan/payment/payment.dto.ts",
      "apps/api/src/modules/loan/payment/payment.module.ts",
      "apps/api/src/modules/loan/payment/payment.service.ts",
      "apps/web/src/config/nav.ts",
      "apps/web/src/features/loan/payment/api.ts",
      "apps/web/src/features/loan/payment/payment-form.tsx",
      "apps/web/src/features/loan/payment/payment-page.tsx",
      "apps/web/src/routes/_app/loan/payment.tsx",
      "packages/db/prisma/models/loan/payment.prisma",
      "packages/validators/src/index.ts",
      "packages/validators/src/loan/payment.ts",
    ])

    // Schemas: skeletons, exported from the package index.
    expect(content("packages/validators/src/loan/payment.ts")).toContain('from "../api"')
    expect(content("packages/validators/src/loan/payment.ts")).toContain("export const createPaymentSchema = z.object({")
    expect(content("packages/validators/src/index.ts")).toMatch(/export \* from "\.\/loan\/payment"\n\/\/ klin-anchor:exports/)

    // Model: id + timestamps, the fields left to you.
    expect(content("packages/db/prisma/models/loan/payment.prisma")).toMatch(/model Payment \{[\s\S]*@@map\("payment"\)/)
    expect(content("packages/db/prisma/models/loan/payment.prisma")).toContain("bun run db:migrate --name add-payment")

    // API: five endpoints on /api/loan/payment, DTOs, and a service that queries the model.
    const controller = content("apps/api/src/modules/loan/payment/payment.controller.ts")
    expect(controller).toContain('@Controller("loan/payment")')
    for (const route of ["@Get()", '@Get(":id")', "@Post()", '@Patch(":id")', '@Delete(":id")']) expect(controller).toContain(route)
    expect(content("apps/api/src/modules/loan/payment/payment.dto.ts")).toContain("export class CreatePaymentDto extends createZodDto(createPaymentSchema) {}")
    const service = content("apps/api/src/modules/loan/payment/payment.service.ts")
    expect(service).toContain('from "../../../common"')
    expect(service).toContain("this.prisma.payment.findMany")
    expect(service).not.toContain("NotImplementedException")
    const appModule = content("apps/api/src/app.module.ts")
    expect(appModule).toContain('import { PaymentModule } from "./modules/loan/payment/payment.module"\n// klin-anchor:module-imports')
    expect(appModule).toMatch(/ {4}PaymentModule,\n {4}\/\/ klin-anchor:modules/)

    // Web: hooks on /loan/payment, a route under the app shell and a sidebar entry.
    expect(content("apps/web/src/features/loan/payment/api.ts")).toContain('api.get<PaymentList>("/loan/payment", query, signal)')
    expect(content("apps/web/src/routes/_app/loan/payment.tsx")).toContain('createFileRoute("/_app/loan/payment")')
    expect(content("apps/web/src/routes/_app/loan/payment.tsx")).toContain('from "@/features/loan/payment/payment-page"')
    expect(content("apps/web/src/config/nav.ts")).toContain('{ id: "loan-payment", title: "Payments", to: "/loan/payment", icon: ReceiptIcon },')
    expect(content("apps/web/src/config/nav.ts")).toMatch(/ReceiptIcon,\n\s*\/\/ klin-anchor:nav-icons/)
  })

  it("makes a backend module whose service is left to fill in", async () => {
    const { plan } = await project()
    const result = plan("backend", "payments")
    const edits = byPath(result)
    expect([...edits.keys()].some((path) => path.startsWith("apps/web") || path.startsWith("packages/db"))).toBe(false)
    expect(edits.has("apps/api/src/modules/payments/payments.controller.ts")).toBe(true)
    expect(edits.get("apps/api/src/modules/payments/payments.controller.ts")?.content).toContain("constructor(private readonly payments: PaymentsService) {}")
    expect(edits.get("apps/api/src/modules/payments/payments.service.ts")?.content).toContain("throw new NotImplementedException")
    expect(edits.has("packages/validators/src/payment.ts")).toBe(true)
    expect(result.warnings).toEqual([])
  })

  it("makes a frontend feature with its schemas, and reuses them for the backend later", async () => {
    const { plan, apply } = await project()
    const frontend = byPath(apply(plan("frontend", "loan/payment")))
    expect([...frontend.keys()].some((path) => path.startsWith("apps/api"))).toBe(false)
    expect(frontend.get("packages/validators/src/loan/payment.ts")?.kind).toBe("create")

    const backend = byPath(apply(plan("backend", "loan/payment")))
    expect(backend.get("packages/validators/src/loan/payment.ts")?.kind).toBe("keep")
    expect(backend.has("packages/validators/src/index.ts")).toBe(false)
    expect(backend.has("apps/api/src/modules/loan/payment/payment.module.ts")).toBe(true)
  })

  it("puts a second name into an existing organization folder", async () => {
    const { plan, apply, files } = await project()
    apply(plan("resource", "loan/payment"))
    apply(plan("backend", "loan/schedule"))
    expect(files.get("apps/api/src/app.module.ts")).toContain('import { ScheduleModule } from "./modules/loan/schedule/schedule.module"')
    expect(files.get("apps/api/src/app.module.ts")).toContain('import { PaymentModule } from "./modules/loan/payment/payment.module"')
  })

  it("refuses names that would clash, and files that exist without --force", async () => {
    const { plan, apply } = await project()
    apply(plan("resource", "loan/payment"))
    expect(() => plan("backend", "order/payment")).toThrow(PlanError)
    expect(() => plan("backend", "order/payment")).toThrow(/already exports createPaymentSchema/)
    expect(() => plan("resource", "loan/payment")).toThrow(/already exists/)
    expect(() => plan("resource", "user")).toThrow(PlanError)
    expect(plan("resource", "loan/payment", { force: true }).edits.find((e) => e.path.endsWith("payment.controller.ts"))?.kind).toBe("update")
  })
})

describe("generate: plain backends", () => {
  it.each(["express", "fastify"] as const)("mounts routes and a service on %s", async (server) => {
    const { plan } = await project({ backend: "plain", server })
    const edits = byPath(plan("resource", "loan/payment"))
    const routes = edits.get("apps/api/src/routes/loan/payment.ts")?.content ?? ""
    const service = edits.get("apps/api/src/services/loan/payment.ts")?.content ?? ""
    const app = edits.get("apps/api/src/app.ts")?.content ?? ""
    expect(routes).toContain('from "../../lib/http"')
    expect(routes).toContain('import * as payments from "../../services/loan/payment"')
    expect(service).toContain("export async function listPayments(query: PaymentListQuery)")
    expect(service).toContain("prisma.payment.findMany")
    if (server === "express") {
      expect(app).toContain('import { paymentRouter } from "./routes/loan/payment"')
      expect(app).toContain('app.use("/api/loan/payment", paymentRouter)')
    } else {
      expect(routes).toContain('from "../../hooks/auth"')
      expect(app).toContain('await app.register(paymentRoutes, { prefix: "/api/loan/payment" })')
    }
    expect([...edits.keys()].some((path) => path.includes("/modules/"))).toBe(false)
  })

  it("leaves a 501 in each function of a backend-only service", async () => {
    const { plan } = await project({ backend: "plain", server: "express" })
    const service = byPath(plan("backend", "payment")).get("apps/api/src/services/payment.ts")?.content ?? ""
    expect(service.match(/throw notImplemented\(/g)).toHaveLength(5)
  })
})

describe("generate: shared UI package", () => {
  it("imports shadcn components from @repo/ui", async () => {
    const { plan } = await project({ components: "packages-ui" })
    const page = byPath(plan("frontend", "payment")).get("apps/web/src/features/payment/payment-page.tsx")?.content ?? ""
    expect(page).toContain('from "@repo/ui/components/button"')
    expect(page).not.toContain('"@/components/ui/')
  })
})

describe("generate: flags", () => {
  it("--url serves the API and the page somewhere other than the folders", async () => {
    const { plan } = await project()
    const edits = byPath(plan("resource", "blog/post", { url: "/api/articles/" }))
    expect(edits.has("apps/api/src/modules/blog/post/post.controller.ts")).toBe(true)
    expect(edits.get("apps/api/src/modules/blog/post/post.controller.ts")?.content).toContain('@Controller("articles")')
    expect(edits.get("apps/web/src/features/blog/post/api.ts")?.content).toContain('api.get<PostList>("/articles", query, signal)')
    expect(edits.get("apps/web/src/routes/_app/articles.tsx")?.content).toContain('createFileRoute("/_app/articles")')
    expect(edits.has("apps/web/src/routes/_app/blog/post.tsx")).toBe(false)
    expect(edits.get("apps/web/src/config/nav.ts")?.content).toContain('{ id: "blog-post", title: "Posts", to: "/articles", icon: NewspaperIcon },')

    const plain = await project({ backend: "plain", server: "express" })
    expect(byPath(plain.plan("backend", "blog/post", { url: "articles" })).get("apps/api/src/app.ts")?.content).toContain('app.use("/api/articles", postRouter)')
  })

  it("--url refuses a path another controller or router already serves", async () => {
    const nest = await project()
    expect(() => nest.plan("backend", "blog/post", { url: "notes" })).toThrow(/already serves \/api\/notes/)
    const fastify = await project({ backend: "plain", server: "fastify" })
    expect(() => fastify.plan("backend", "blog/post", { url: "notes" })).toThrow(/already serves \/api\/notes/)
    expect(() => parseTarget("post", { url: "/api/" })).toThrow(/--url needs a path/)
  })

  it("--plural fixes a wrong guess", async () => {
    const t = parseTarget("criterion", { plural: "criteria" })
    expect(t.one.pascal).toBe("Criterion")
    expect(t.many.title).toBe("Criteria")
    const { plan } = await project({ backend: "plain", server: "express" })
    const edits = byPath(plan("resource", "criterion", { plural: "criteria" }))
    expect(edits.get("apps/api/src/services/criterion.ts")?.content).toContain("export async function listCriteria(")
    expect(edits.get("apps/web/src/features/criterion/api.ts")?.content).toContain("export function useCriteria(")
    expect(() => parseTarget("criterion", { plural: "a/b" })).toThrow(/single word/)
  })

  it("--no-model leaves the database alone and the service to fill in", async () => {
    const { plan } = await project()
    const edits = byPath(plan("resource", "post", { model: false }))
    expect([...edits.keys()].some((path) => path.startsWith("packages/db"))).toBe(false)
    expect(edits.get("apps/api/src/modules/post/post.service.ts")?.content).toContain("NotImplementedException")
    expect(edits.has("apps/web/src/routes/_app/post.tsx")).toBe(true)
  })

  it("--no-validation writes nothing in packages/validators and reuses schemas that exist", async () => {
    const { plan, apply } = await project()
    apply(plan("frontend", "blog/post"))
    const reuse = plan("backend", "post", { validation: false })
    expect([...byPath(reuse).keys()].some((path) => path.startsWith("packages/validators"))).toBe(false)
    expect(reuse.warnings).toEqual([])

    const missing = plan("frontend", "comment", { validation: false })
    expect([...byPath(missing).keys()].some((path) => path.startsWith("packages/validators"))).toBe(false)
    expect(missing.warnings.join("\n")).toMatch(/doesn't export createCommentSchema, Comment, CommentList/)
  })

  it("--no-route skips the route and the nav entry; --no-nav just the nav entry", async () => {
    const { plan } = await project()
    const noRoute = byPath(plan("frontend", "post", { route: false }))
    expect(noRoute.has("apps/web/src/features/post/post-page.tsx")).toBe(true)
    expect(noRoute.has("apps/web/src/routes/_app/post.tsx")).toBe(false)
    expect(noRoute.has("apps/web/src/config/nav.ts")).toBe(false)

    const noNav = byPath(plan("frontend", "post", { nav: false }))
    expect(noNav.has("apps/web/src/routes/_app/post.tsx")).toBe(true)
    expect(noNav.has("apps/web/src/config/nav.ts")).toBe(false)
  })

  it("says when a flag does nothing for the kind", async () => {
    const { plan } = await project()
    expect(plan("backend", "post", { nav: false, route: false }).warnings).toHaveLength(2)
    expect(plan("frontend", "post", { model: false }).warnings[0]).toMatch(/--no-model does nothing here/)
  })
})

describe("generate: Next.js", () => {
  it("writes an App Router page, a client feature page and a proxy entry", async () => {
    const { plan } = await project({ web: "next" })
    const edits = byPath(plan("resource", "billing/invoice"))
    const content = (path: string) => edits.get(path)?.content ?? ""

    const page = content("apps/web/src/app/(app)/billing/invoice/page.tsx")
    expect(page).toContain('import { InvoicePage } from "@/features/billing/invoice/invoice-page"')
    expect(page).toContain('export const metadata: Metadata = { title: "Invoices" }')
    expect(page).toContain("return <InvoicePage />")
    expect(content("apps/web/src/features/billing/invoice/invoice-page.tsx")).toMatch(/^"use client"\n\n/)
    expect(content("apps/web/src/features/billing/invoice/invoice-form.tsx")).not.toContain("use client")
    expect([...edits.keys()].some((path) => path.includes("routes/_app"))).toBe(false)

    const proxy = content("apps/web/src/proxy.ts")
    expect(proxy).toMatch(/"\/billing\/invoice\/:path\*",\n\s*\/\/ klin-anchor:protected-routes/)
    expect(content("apps/web/src/config/nav.ts")).toContain('to: "/billing/invoice"')
  })

  it("leaves the proxy alone when a parent path is already protected", async () => {
    const { plan } = await project({ web: "next" })
    const edits = byPath(plan("frontend", "settings/billing"))
    expect(edits.has("apps/web/src/app/(app)/settings/billing/page.tsx")).toBe(true)
    expect(edits.has("apps/web/src/proxy.ts")).toBe(false)
  })

  it("refuses a URL a page in another route group already serves", async () => {
    const { plan } = await project({ web: "next" })
    expect(() => plan("frontend", "login", { url: "sign-in" })).toThrow(/\(auth\)\/sign-in\/page\.tsx already serves \/sign-in/)
  })

  it("--no-route writes no page and no proxy entry", async () => {
    const { plan } = await project({ web: "next" })
    const edits = byPath(plan("frontend", "post", { route: false }))
    expect([...edits.keys()].some((path) => path.startsWith("apps/web/src/app/"))).toBe(false)
    expect(edits.has("apps/web/src/proxy.ts")).toBe(false)
  })
})

describe("generate: folders", () => {
  const nest = { backend: "nest" as const, web: "vite" as const }

  it("normalizes a folder and keeps it inside its layer", () => {
    expect(parseDir("frontend", "./apps/web/src/pages/")).toBe("apps/web/src/pages")
    expect(parseDir("frontend", "apps\\web\\src\\pages")).toBe("apps/web/src/pages")
    expect(parseDir("backend", "apps/api/src")).toBe("apps/api/src")
    expect(parseDir("model", "packages/db/prisma/domain")).toBe("packages/db/prisma/domain")
    expect(() => parseDir("frontend", "")).toThrow(/Give it a folder/)
    expect(() => parseDir("frontend", "/home/me/app/src")).toThrow(/inside the project/)
    expect(() => parseDir("frontend", "C:\\app")).toThrow(/inside the project/)
    expect(() => parseDir("frontend", "~/app")).toThrow(/inside the project/)
    expect(() => parseDir("frontend", "apps/web/src/../../api/src")).toThrow(/would step outside/)
    expect(() => parseDir("frontend", "apps/web/src/my pages")).toThrow(/isn't a valid folder name/)
    expect(() => parseDir("frontend", "apps/web/pages")).toThrow(/inside apps\/web\/src/)
    expect(() => parseDir("validation", "packages/ui/src")).toThrow(/inside packages\/validators\/src/)
    expect(() => parseDir("frontend", "apps/web/src/routes/features")).toThrow(/Not inside apps\/web\/src\/routes/)
    expect(() => parseDir("frontend", "apps/web/src/app/features", undefined, "next")).toThrow(/Not inside apps\/web\/src\/app/)
    expect(parseDir("frontend", "apps/web/src/app/features")).toBe("apps/web/src/app/features")
    expect(() => parseDir("model", "packages/db/prisma/migrations")).toThrow(/Not inside packages\/db\/prisma\/migrations/)
    expect(() => parseDir("backend", "apps/api/src/main.ts", { read: () => "file" })).toThrow(/is a file/)
  })

  it("reads defaults from klin.json and saves only what differs from klin's", () => {
    const config = { version: "0", template: "bundled", name: "x", packageManager: "bun@1", answers: {} }
    expect(projectDirs(config, nest)).toEqual(defaultDirs(nest))
    expect(defaultDirs({ backend: "plain" }).backend).toBe("apps/api/src")
    const next = { ...nest, web: "next" as const }
    expect(() => projectDirs({ ...config, generate: { paths: { frontend: "apps/web/src/app/x" } } }, next)).toThrow(/Not inside apps\/web\/src\/app/)

    const saved = withDirs(config, nest, { ...defaultDirs(nest), frontend: "apps/web/src/pages" })
    expect(saved.generate).toEqual({ paths: { frontend: "apps/web/src/pages" } })
    expect(projectDirs(saved, nest).frontend).toBe("apps/web/src/pages")
    expect(withDirs(saved, nest, defaultDirs(nest))).not.toHaveProperty("generate")

    const broken = { ...config, generate: { paths: { model: "../prisma" } } }
    expect(() => projectDirs(broken, nest)).toThrow(/klin\.json → generate\.paths\.model/)
  })

  it("writes every layer into custom folders, with imports that still resolve (NestJS)", async () => {
    const { plan } = await project()
    const dirs = {
      backend: "apps/api/src/app/features",
      frontend: "apps/web/src/pages",
      validation: "packages/validators/src/schemas",
      model: "packages/db/prisma/domain",
    }
    const edits = byPath(plan("resource", "blog/post", { dirs }))
    const content = (path: string) => edits.get(path)?.content ?? ""
    expect(content("apps/api/src/app/features/blog/post/post.service.ts")).toContain('from "../../../../common"')
    expect(content("apps/api/src/app.module.ts")).toContain('import { PostModule } from "./app/features/blog/post/post.module"')
    expect(content("packages/validators/src/schemas/blog/post.ts")).toContain('from "../../api"')
    expect(content("packages/validators/src/index.ts")).toContain('export * from "./schemas/blog/post"')
    expect(edits.has("packages/db/prisma/domain/blog/post.prisma")).toBe(true)
    expect(edits.has("apps/web/src/pages/blog/post/post-page.tsx")).toBe(true)
    expect(content("apps/web/src/routes/_app/blog/post.tsx")).toContain('from "@/pages/blog/post/post-page"')
  })

  it("keeps routes/ and services/ inside a plain backend's folder", async () => {
    const { plan } = await project({ backend: "plain", server: "express" })
    const dirs = { ...defaultDirs({ backend: "plain" }), backend: "apps/api/src/http" }
    const edits = byPath(plan("backend", "blog/post", { dirs }))
    expect(edits.get("apps/api/src/http/routes/blog/post.ts")?.content).toContain('from "../../../lib/http"')
    expect(edits.has("apps/api/src/http/services/blog/post.ts")).toBe(true)
    expect(edits.get("apps/api/src/app.ts")?.content).toContain('import { postRouter } from "./http/routes/blog/post"')
  })
})
