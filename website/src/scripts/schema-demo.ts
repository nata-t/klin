import { type DemoField, FIELDS } from "../lib/schema-demo"
import { highlight } from "./highlight"

/**
 * "Write the shape once": snapping a field on adds its line to the schema,
 * then a pulse runs down each wire and the form, the API and the types pick it
 * up. The form validates as you type with the rules (and messages) the schema
 * line states, and the API pane answers 201 or 422 the way the generated
 * endpoint would.
 */
export function mountSchemaDemo(root: HTMLElement) {
  const on = new Set(FIELDS.filter((f) => f.always || f.id === "amount").map((f) => f.id))
  const values = new Map(FIELDS.map((f) => [f.id, f.initial]))
  const touched = new Set<string>()
  let fresh = new Set<string>()
  let submitted = false

  const code = root.querySelector<HTMLElement>("[data-schema-code]")!
  const inputs = root.querySelector<HTMLElement>("[data-schema-inputs]")!
  const form = root.querySelector<HTMLFormElement>("[data-schema-form]")!
  const formState = root.querySelector<HTMLElement>("[data-schema-form-state]")!
  const request = root.querySelector<HTMLElement>("[data-schema-request]")!
  const response = root.querySelector<HTMLElement>("[data-schema-response]")!
  const typeEl = root.querySelector<HTMLElement>("[data-schema-type]")!
  const wires = root.querySelector<SVGSVGElement>("[data-wires]")!
  const grid = root.querySelector<HTMLElement>("[data-schema-grid]")!
  const source = root.querySelector<HTMLElement>("[data-schema-source]")!
  const targets = [...root.querySelectorAll<HTMLElement>("[data-target]")]

  const active = () => FIELDS.filter((f) => on.has(f.id))

  /* ─── The schema file ─────────────────────────────────────────────── */

  function renderSchema() {
    const lines: [text: string, id?: string][] = [
      [`import { z } from "zod"`],
      [`import { idSchema, isoDate } from "../common"`],
      [""],
      [`const invoiceFields = {`],
      ...active().map((f): [string, string] => [`  ${f.zod}`, f.id]),
      [`}`],
      [""],
      [`export const createInvoiceSchema = z.object({`],
      [`  ...invoiceFields,`],
      [`})`],
      [""],
      [`/** PATCH semantics: every field optional. */`],
      [`export const updateInvoiceSchema = z.object(invoiceFields).partial()`],
      [""],
      [`/** What the API sends back. Fields left out here never leave the API. */`],
      [`export const invoiceSchema = z.object({`],
      [`  id: idSchema,`],
      ...active().map((f): [string, string] => [`  ${f.response}`, f.id]),
      [`  createdAt: isoDate(),`],
      [`  updatedAt: isoDate(),`],
      [`})`],
      [""],
      [`export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>`],
    ]
    code.innerHTML = lines
      .map(([text, id]) => `<span class="line${id && fresh.has(id) ? " new" : ""}">${highlight(text) || " "}</span>`)
      .join("")
  }

  /* ─── The form ────────────────────────────────────────────────────── */

  // While you're in a field it shows focus, not its error.
  const control =
    "h-36 rounded-[5px] border border-line bg-bg px-10 py-0 font-sans text-[14px] text-bright scheme-dark focus:border-muted focus:outline-none aria-invalid:not-focus:border-error"

  function inputFor(f: DemoField) {
    const value = values.get(f.id) ?? ""
    const id = `schema-${f.id}`
    if (f.input.kind === "select") {
      const options = f.input.options!.map((o) => `<option${o === value ? " selected" : ""}>${o}</option>`).join("")
      return `<select class="${control}" id="${id}" data-input="${f.id}">${options}</select>`
    }
    return `<input class="${control}" id="${id}" data-input="${f.id}" type="${f.input.kind}" value="${escape(value)}" ${f.input.kind === "number" ? 'inputmode="decimal" step="any"' : ""} autocomplete="off" />`
  }

  function renderForm() {
    inputs.innerHTML = active()
      .map(
        (f) =>
          `<label class="grid gap-6 font-mono text-[12px] text-text${fresh.has(f.id) ? " animate-field-in" : ""}" for="schema-${f.id}"><span>${f.label}${f.id === "notes" ? ' <span class="text-subtle">· optional</span>' : ""}</span>${inputFor(f)}<span class="min-h-0 font-sans text-[12px] text-error" data-msg="${f.id}"></span></label>`
      )
      .join("")
    validate()
  }

  function errors() {
    const out: { field: string; message: string }[] = []
    for (const f of active()) {
      const message = f.check(values.get(f.id) ?? "")
      if (message) out.push({ field: f.id, message })
    }
    return out
  }

  function validate() {
    const issues = errors()
    for (const f of active()) {
      const issue = issues.find((i) => i.field === f.id)
      const show = issue && (touched.has(f.id) || submitted)
      const input = inputs.querySelector<HTMLElement>(`[data-input="${f.id}"]`)
      const msg = inputs.querySelector<HTMLElement>(`[data-msg="${f.id}"]`)
      input?.setAttribute("aria-invalid", show ? "true" : "false")
      if (msg) msg.textContent = show ? issue!.message : ""
    }
    formState.textContent = issues.length ? `${issues.length} field${issues.length === 1 ? "" : "s"} to fix` : "✓ passes createInvoiceSchema"
    renderExchange(issues)
  }

  /* ─── The API ─────────────────────────────────────────────────────── */

  function body() {
    const out: Record<string, unknown> = {}
    for (const f of active()) {
      const v = f.json(values.get(f.id) ?? "")
      if (v !== undefined) out[f.id] = v
    }
    return out
  }

  function renderExchange(issues = errors()) {
    const json = JSON.stringify(body(), null, 2)
    request.innerHTML = `<span class="p">POST /api/billing/invoice</span>\n${highlight(json, true)}`
    if (issues.length) {
      // The template API's error envelope (apps/api/src/common/filters/api-exception.filter.ts), meta left out.
      const first = issues[0]!
      const detail = JSON.stringify(
        { success: false, error: { code: "VALIDATION_ERROR", message: `${first.field}: ${first.message}`, statusCode: 422, details: issues } },
        null,
        2
      )
      response.innerHTML = `<span class="err">422 Unprocessable</span>\n${highlight(detail, true)}`
    } else {
      const sent = body()
      const data: Record<string, unknown> = { id: "cmv8x2…", ...sent }
      if (on.has("status") && !("status" in data)) data.status = "draft"
      data.createdAt = "2026-10-14T…"
      const detail = JSON.stringify({ success: true, data }, null, 2)
      response.innerHTML = `<span class="ok">201 Created</span>\n${highlight(detail, true)}`
    }
  }

  /* ─── The types ───────────────────────────────────────────────────── */

  function renderType() {
    const lines = ["type CreateInvoiceInput = {", ...active().map((f) => `  ${f.type}`), "}"]
    typeEl.innerHTML = lines
      .map((line, i) => {
        const f = active()[i - 1]
        return `<span class="line${f && fresh.has(f.id) ? " new" : ""}">${highlight(line)}</span>`
      })
      .join("")
  }

  /* ─── Wires ───────────────────────────────────────────────────────── */

  const NS = "http://www.w3.org/2000/svg"
  const make = (tag: string, attrs: Record<string, string>) => {
    const el = document.createElementNS(NS, tag)
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v)
    return el
  }
  const bases = targets.map(() => make("path", { fill: "none", stroke: "#444", "stroke-dasharray": "2 4" }) as SVGPathElement)
  const paths = targets.map(
    () => make("path", { fill: "none", stroke: "#eee", "stroke-width": "1.5", "stroke-linecap": "round", opacity: "0" }) as SVGPathElement
  )
  const dot = make("circle", { r: "3", fill: "#eee" })
  wires.append(...bases, ...paths, dot)

  // The source card is sticky, so the wires follow it while the section scrolls.
  function layoutWires() {
    if (getComputedStyle(wires).display === "none") return
    const g = grid.getBoundingClientRect()
    const s = source.getBoundingClientRect()
    const anchor = code.querySelectorAll(".line")[4]?.getBoundingClientRect()
    const sx = s.right - g.left
    const sy = (anchor ? anchor.top + anchor.height / 2 : s.top + 80) - g.top
    dot.setAttribute("cx", String(sx))
    dot.setAttribute("cy", String(sy))
    targets.forEach((t, i) => {
      const r = t.getBoundingClientRect()
      const tx = r.left - g.left
      const ty = r.top - g.top + 18
      const mid = (sx + tx) / 2
      const d = `M ${sx} ${sy} C ${mid} ${sy}, ${mid} ${ty}, ${tx} ${ty}`
      bases[i]!.setAttribute("d", d)
      paths[i]!.setAttribute("d", d)
    })
  }

  function pulse() {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    paths.forEach((path, i) => {
      const length = path.getTotalLength()
      path.setAttribute("opacity", "1")
      path.style.strokeDasharray = `46 ${length + 50}`
      if (!still) {
        path.animate([{ strokeDashoffset: 46 }, { strokeDashoffset: -length }], {
          duration: 700,
          delay: i * 90,
          easing: "cubic-bezier(0.4, 0, 0.2, 1)",
          fill: "forwards",
        })
      }
      const target = targets[i]!
      setTimeout(() => {
        target.dataset.lit = "true"
        setTimeout(() => (target.dataset.lit = "false"), 700)
      }, still ? 0 : 520 + i * 90)
    })
  }

  /* ─── Wiring it up ────────────────────────────────────────────────── */

  function render() {
    renderSchema()
    renderForm()
    renderType()
    requestAnimationFrame(layoutWires)
  }

  root.querySelectorAll<HTMLButtonElement>("[data-field]").forEach((chip) => {
    const id = chip.dataset.field!
    const sync = () => {
      chip.setAttribute("aria-pressed", String(on.has(id)))
      chip.querySelector("[data-mark]")!.textContent = on.has(id) ? "◼" : "◻"
    }
    sync()
    chip.addEventListener("click", () => {
      if (on.has(id)) on.delete(id)
      else on.add(id)
      fresh = new Set(on.has(id) ? [id] : [])
      sync()
      render()
      pulse()
    })
  })

  inputs.addEventListener("input", (event) => {
    const el = event.target as HTMLInputElement
    const id = el.dataset.input
    if (!id) return
    values.set(id, el.value)
    touched.add(id)
    validate()
  })
  inputs.addEventListener("change", (event) => {
    const el = event.target as HTMLInputElement
    if (el.dataset.input) touched.add(el.dataset.input)
    validate()
  })
  form.addEventListener("submit", (event) => {
    event.preventDefault()
    submitted = true
    validate()
    pulse()
  })

  render()
  new ResizeObserver(() => layoutWires()).observe(grid)
  let queued = false
  window.addEventListener(
    "scroll",
    () => {
      if (queued) return
      queued = true
      requestAnimationFrame(() => {
        queued = false
        layoutWires()
      })
    },
    { passive: true }
  )
}

function escape(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;")
}
