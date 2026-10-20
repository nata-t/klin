import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { describeName } from "../src/commands/wizard"
import { type ChipField, type ChipItem, Form, type InputField, type Page } from "../src/ui/form"
import { logoSizeFor } from "../src/ui/logo"
import type { Key } from "../src/ui/term"
import { hue, parseColor, width, wrap } from "../src/ui/theme"

const key = (name: string, sequence = name.length === 1 ? name : ""): Key => ({ name, sequence, ctrl: false, shift: false, meta: false })

function page() {
  const picked = new Set(["cors"])
  const input: InputField = {
    kind: "input",
    id: "name",
    label: "Name your kit",
    value: "",
    caret: 0,
    filter: (ch) => (ch === " " ? "-" : ch),
    validate: (value) => (value ? { tone: "ok", message: `./${value} is free to use` } : { tone: "error", message: "Give your kit a name" }),
  }
  const chips: ChipField = {
    kind: "chips",
    id: "security",
    title: "Security",
    multi: true,
    items: ["cors", "helmet", "rate-limit"].map((id) => ({ id, label: id.toUpperCase(), about: `About ${id}` })),
    isOn: (id) => picked.has(id),
    toggle: (id) => void (picked.has(id) ? picked.delete(id) : picked.add(id)),
  }
  const p: Page = {
    steps: { labels: ["Base", "Stack", "Auth", "Toolbox", "Looks", "Build"], current: 3 },
    heading: "Fill the toolbox.",
    subtitle: "Space snaps a part on or off.",
    fields: [input, chips],
    keys: [["space", "snap"], ["enter", "next"]],
  }
  return { p, input, picked }
}

describe("full-screen form", () => {
  it("lays out at every terminal size without throwing", () => {
    const { p } = page()
    const form = new Form(p)
    for (const [w, h] of [[30, 10], [40, 12], [60, 20], [80, 24], [120, 40], [200, 60]] as const) {
      const text = form.render(w, h).toString()
      if (w < 40 || h < 12) expect(text).toContain("more room")
      else {
        // The header (steps + logo) stays put even when the body scrolls.
        expect(text).toMatch(/klin|█▄▀|████    ████/)
        expect(text).toContain("TOOLBOX")
        if (h >= 24) expect(text).toContain("Fill the toolbox.")
        if (h >= 24) expect(text).toContain("SECURITY")
      }
    }
  })

  it("centers the heading, the help and the key hints", () => {
    const lines = new Form(page().p).render(120, 40).toString().split("\n")
    for (const needle of ["Fill the toolbox.", "Space snaps a part on or off.", "Name your kit", "snap"]) {
      const line = lines.find((l) => l.includes(needle))!
      const textStart = line.search(/\S/)
      expect(Math.abs(textStart - (120 - line.length)), needle).toBeLessThanOrEqual(2)
    }
  })

  it("types into the input, moves to the chips and snaps them", () => {
    const { p, input, picked } = page()
    const form = new Form(p)
    form.render(120, 40)
    for (const ch of "my app") form.key(key(ch, ch))
    expect(input.value).toBe("my-app")
    expect(form.render(120, 40).toString()).toContain("./my-app is free to use")
    form.key(key("down"))
    form.key(key("down"))
    form.key(key("space", " "))
    expect(picked.has("helmet")).toBe(true)
    expect(form.render(120, 40).toString()).toContain("About helmet")
    expect(form.key(key("return"))).toBe("submit")
    expect(form.key(key("escape"))).toBe("back")
    expect(form.key({ ...key("c"), ctrl: true })).toBe("cancel")
  })
})

/** A page of small pick-one groups: three of them, so two pair up and one sits below. */
function grid() {
  const picked: Record<string, string> = { framework: "nest", server: "express", database: "postgres" }
  const group = (id: string, items: string[]): ChipField => ({
    kind: "chips",
    id,
    title: id,
    note: "pick one",
    multi: false,
    items: items.map((item): ChipItem => ({ id: item, label: item })),
    isOn: (item) => picked[id] === item,
    toggle: (item) => void (picked[id] = item),
  })
  const input: InputField = { kind: "input", id: "name", label: "Name", value: "app", caret: 3, validate: () => ({ tone: "ok", message: "fine" }) }
  const p: Page = {
    steps: { labels: ["Base", "Stack", "Build"], current: 1 },
    heading: "Pick your engine.",
    fields: [input, group("framework", ["nest", "plain"]), group("server", ["express", "fastify"]), group("database", ["postgres", "mysql", "sqlite"])],
    keys: [["space", "snap"]],
  }
  return { p, picked }
}

const rowOf = (text: string, needle: string) => text.split("\n").findIndex((line) => line.includes(needle))
/** Which logo a screen shows: the big lockup, the regular one, the compact one, or the one-liner. */
const logoIn = (text: string) => (text.includes("████    ████") ? 10 : text.includes("█▄▀") ? 6 : /███ +klin/.test(text) ? 3 : 1)

describe("full-screen layout", () => {
  it("puts the logo under the step indicator and shrinks it to fit", () => {
    const form = new Form(page().p)
    const big = form.render(120, 40).toString()
    expect(logoIn(big)).toBe(10)
    expect(rowOf(big, "TOOLBOX")).toBeLessThan(rowOf(big, "████    ████"))
    expect(big).not.toMatch(/TOOLBOX.*██/)
    expect(logoIn(form.render(80, 28).toString())).toBe(3)
    expect(logoIn(form.render(60, 20).toString())).toBe(1)
  })

  it("draws the tallest logo that fits, down to one line", () => {
    expect([10, 9, 6, 5, 3, 2].map((rows) => logoSizeFor(rows, 120))).toEqual([10, 6, 6, 3, 3, 1])
    // Too narrow for the big lockup: the regular one.
    expect(logoSizeFor(10, 46)).toBe(6)
    expect(logoIn(new Form(page().p).render(120, 44).toString())).toBe(10)
  })

  it("keeps the logo one size across the pages of a flow", () => {
    const short = page().p
    const tall = grid().p
    // On their own, a short page gets a bigger logo than a tall one at this height…
    expect(logoIn(new Form(short).render(100, 28).toString())).toBeGreaterThan(logoIn(new Form(tall).render(100, 28).toString()))
    // …but with the flow's room they match.
    const room = (width: number) => Math.max(new Form(short).bodyHeight(width), new Form(tall).bodyHeight(width))
    const sizes = [short, tall].map((p) => logoIn(new Form({ ...p, room }).render(100, 28).toString()))
    expect(sizes[0]).toBe(sizes[1])
  })

  it("lists each group in one column, two side by side, the odd one out centered below", () => {
    const text = new Form(grid().p).render(120, 40).toString()
    expect(rowOf(text, "FRAMEWORK")).toBe(rowOf(text, "SERVER"))
    expect(rowOf(text, "plain")).toBe(rowOf(text, "nest") + 1)
    expect(rowOf(text, "sqlite")).toBe(rowOf(text, "postgres") + 2)
    const below = text.split("\n")[rowOf(text, "DATABASE")]!
    expect(rowOf(text, "DATABASE")).toBeGreaterThan(rowOf(text, "FRAMEWORK"))
    const title = below.indexOf("DATABASE")
    const end = title + width("DATABASE  · pick one")
    expect(Math.abs(title - (120 - end))).toBeLessThanOrEqual(2)
  })

  it("stacks the groups when two columns don't fit", () => {
    const { p } = grid()
    for (const field of p.fields) if (field.kind === "chips") field.items[0]!.label = "a rather long option name"
    const narrow = new Form(p).render(50, 60).toString()
    expect(rowOf(narrow, "SERVER")).toBeGreaterThan(rowOf(narrow, "FRAMEWORK"))
    const wide = new Form(p).render(120, 60).toString()
    expect(rowOf(wide, "SERVER")).toBe(rowOf(wide, "FRAMEWORK"))
  })

  it("moves through the grid with the arrow keys", () => {
    const { p, picked } = grid()
    const form = new Form(p)
    const press = (name: string) => {
      form.key(key(name, name === "space" ? " " : ""))
      form.render(120, 40)
    }
    form.render(120, 40)
    press("down") // input → the first group of the row below
    expect(form.cursor).toEqual({ field: 1, item: 0 })
    press("right") // into "server" beside it, on the same line
    expect(form.cursor).toEqual({ field: 2, item: 0 })
    press("left")
    press("down")
    expect(form.cursor).toEqual({ field: 1, item: 1 })
    press("down") // past the end of the list: the centered group below
    expect(form.cursor.field).toBe(3)
    press("up")
    press("up")
    press("up")
    expect(form.cursor.field).toBe(0)
    press("tab")
    press("tab")
    press("down")
    press("space")
    expect(picked.server).toBe("fastify")
  })

  it("colors validation errors red", () => {
    const { p, input } = page()
    const form = new Form(p)
    input.value = ""
    const canvas = form.render(120, 40)
    const row = rowOf(canvas.toString(), "Give your kit a name")
    const col = canvas.toString().split("\n")[row]!.indexOf("Give")
    expect(canvas.cells[row * 120 + col]!.style.fg).toEqual(hue.error)
  })

  it("warns in amber while a part with a warning is switched off", () => {
    const { p, picked } = page()
    const chips = p.fields[1] as ChipField
    chips.items[0]!.warning = "Browsers block calls from other origins."
    const form = new Form(p)
    form.focus("security")
    expect(form.render(120, 40).toString()).not.toContain("is off")
    form.key(key("space", " "))
    expect(picked.has("cors")).toBe(false)
    const canvas = form.render(120, 40)
    const text = canvas.toString()
    expect(text).toContain("▲ CORS is off")
    expect(text).toContain("Browsers block calls from other origins.")
    const row = rowOf(text, "SECURITY")
    const col = text.split("\n")[row]!.indexOf("▲")
    expect(canvas.cells[row * 120 + col]!.style.fg).toEqual(hue.warn)
  })
})

describe("theme", () => {
  it("converts oklch to sRGB", () => {
    const blue = parseColor("oklch(0.424 0.199 265.638)")!
    expect(blue[2]).toBeGreaterThan(blue[0])
    expect(parseColor("oklch(0.922 0 0)")).toEqual([229, 229, 229])
    expect(parseColor("#ff0000")).toEqual([255, 0, 0])
  })

  it("wraps to a width", () => {
    for (const line of wrap("Caps each IP at 120 requests a minute so one client can't flood the API.", 20)) {
      expect(width(line)).toBeLessThanOrEqual(20)
    }
  })
})

describe("project name", () => {
  it("explains what the name means on disk", () => {
    const cwd = mkdtempSync(join(tmpdir(), "klin-name-"))
    mkdirSync(join(cwd, "taken"))
    writeFileSync(join(cwd, "taken", "file.txt"), "x")
    mkdirSync(join(cwd, "empty"))
    expect(describeName(cwd, "fresh")).toEqual({ tone: "ok", message: "./fresh is free to use" })
    expect(describeName(cwd, "empty").tone).toBe("ok")
    expect(describeName(cwd, "taken").tone).toBe("warn")
    expect(describeName(cwd, "").tone).toBe("error")
    expect(describeName(cwd, "My App").message).toContain('package "my-app"')
  })
})
