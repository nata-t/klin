/**
 * Dev harness: drives the interactive wizard with scripted keys and writes
 * each frame as an HTML "screenshot" (colors included), no TTY needed.
 *
 *   FORCE_COLOR=3 pnpm tsx scripts/preview-ui.ts <outDir> [width] [height]
 */
import { mkdirSync, writeFileSync } from "node:fs"
import { join, resolve } from "node:path"
import { loadManifest, normalizeAnswers } from "../src/engine/manifest"
import { wizard } from "../src/commands/wizard"
import type { Canvas } from "../src/ui/canvas"
import { screen, type Key, type View } from "../src/ui/term"
import { gray, type Style } from "../src/ui/theme"

const [outDir = "ui-preview", w = "120", h = "40"] = process.argv.slice(2)
const width = Number(w)
const height = Number(h)
mkdirSync(outDir, { recursive: true })

let view: View | undefined
screen.present = (next: View) => {
  view = next
}
screen.paint = () => {}

const hex = (color: Style["fg"]) => {
  if (color === undefined) return undefined
  const [r, g, b] = typeof color === "string" ? [gray[color], gray[color], gray[color]] : color
  return `rgb(${r},${g},${b})`
}

function toHtml(canvas: Canvas, title: string) {
  const rows: string[] = []
  for (let y = 0; y < canvas.height; y++) {
    let row = ""
    for (let x = 0; x < canvas.width; x++) {
      const cell = canvas.cells[y * canvas.width + x]!
      if (cell.ch === "") continue
      const s = cell.style
      const fg = hex(s.inverse ? s.bg : s.fg) ?? "rgb(196,196,196)"
      const bg = hex(s.inverse ? s.fg : s.bg) ?? "rgb(20,20,20)"
      const deco = [s.underline ? "underline" : "", s.strike ? "line-through" : ""].filter(Boolean).join(" ")
      const ch = cell.ch === "<" ? "&lt;" : cell.ch === ">" ? "&gt;" : cell.ch === "&" ? "&amp;" : cell.ch
      row += `<span style="color:${fg};background:${bg};${s.bold ? "font-weight:700;" : ""}${deco ? `text-decoration:${deco};` : ""}">${ch}</span>`
    }
    rows.push(row)
  }
  return `<!doctype html><meta charset="utf-8"><title>${title}</title>
<style>body{margin:0;background:#141414}pre{margin:0;font:15px/1.2 "JetBrains Mono","DejaVu Sans Mono",monospace;letter-spacing:0}</style>
<pre>${rows.join("\n")}</pre>`
}

const key = (name: string, extra: Partial<Key> = {}): Key => ({ name, sequence: name.length === 1 ? name : "", ctrl: false, shift: false, meta: false, ...extra })
const typeText = (text: string) => [...text].map((ch) => ({ name: ch, sequence: ch, ctrl: false, shift: false, meta: false }))
const settle = () => new Promise((r) => setTimeout(r, 250))

let shot = 0
async function snap(name: string, size = { width, height }) {
  await settle()
  const canvas = view!.render(size.width, size.height)
  const file = join(outDir, `${String(++shot).padStart(2, "0")}-${name}.html`)
  writeFileSync(file, toHtml(canvas, name))
  console.log(file)
}
async function press(...keys: Key[]) {
  for (const k of keys) view!.key(k)
}

const templateDir = resolve(import.meta.dirname, "../../../template")
const manifest = loadManifest(templateDir)
const run = wizard({
  manifest,
  cwd: resolve(outDir),
  name: "",
  pm: "bun",
  pmVersions: { pnpm: "11.20.0", bun: "1.3.14", npm: null },
  preset: "recommended",
  answers: normalizeAnswers(manifest, {}).answers,
  force: false,
  install: true,
  git: true,
})

await snap("base-empty")
await press(...typeText("@@"))
await snap("base-name-error")
await press(key("backspace"), key("backspace"), ...typeText("my cool app"))
await snap("base-typed")
await press(key("down"), key("down"))
await snap("base-pm")
await press(key("right"), key("space"))
await snap("base-preset-saas")
await snap("base-small", { width: 70, height: 26 })
await press(key("return"))
await snap("stack")
await press(key("down"), key("space"), key("right"), key("space"))
await snap("stack-plain-fastify")
await snap("stack-narrow", { width: 80, height: 30 })
await snap("stack-small", { width: 60, height: 20 })
await press(key("return"))
await snap("auth")
await press(key("down"), key("down"), key("down"), key("down"), key("space"))
await snap("auth-2fa")
await press(key("return"))
await snap("toolbox")
await press(key("space"))
await snap("toolbox-cors-off")
await press(key("right"), key("down"), key("down"), key("down"))
await snap("toolbox-i18n")
await press(key("return"))
await snap("looks")
await press(key("down"), key("space"), key("down"), key("right"), key("right"))
await snap("looks-color")
await press(key("space"), key("return"))
await snap("review")
await snap("review-huge", { width: 180, height: 50 })
await press(key("return"))
console.log(JSON.stringify(await run))
process.exit(0)
