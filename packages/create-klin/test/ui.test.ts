import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { describeName } from "../src/commands/wizard"
import { type ChipField, Form, type InputField, type Page } from "../src/ui/form"
import type { Key } from "../src/ui/term"
import { parseColor, width, wrap } from "../src/ui/theme"

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
        // The header (logo + steps) stays put even when the body scrolls.
        expect(text).toMatch(/K L I N|▄█▀/)
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
    form.key(key("right"))
    form.key(key("space", " "))
    expect(picked.has("helmet")).toBe(true)
    expect(form.render(120, 40).toString()).toContain("About helmet")
    expect(form.key(key("return"))).toBe("submit")
    expect(form.key(key("escape"))).toBe("back")
    expect(form.key({ ...key("c"), ctrl: true })).toBe("cancel")
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
