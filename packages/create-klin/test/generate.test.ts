import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import { loadManifest, normalizeAnswers } from "../src/engine/manifest"
import { render } from "../src/engine/render"
import { type Plan, PlanError, planGenerate, type Project, type Reader } from "../src/generators/plan"
import { type GenKind, parseTarget, resolveKind } from "../src/generators/target"
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
    packagesUi: answers.components === "packages-ui",
    pm: "bun",
  }
  const plan = (kind: GenKind, name: string, force = false) => planGenerate(kind, parseTarget(name), info, fs, { force })
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
    expect(plan("resource", "loan/payment", true).edits.find((e) => e.path.endsWith("payment.controller.ts"))?.kind).toBe("update")
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
