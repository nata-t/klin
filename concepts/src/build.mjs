// Builds the concept files: concepts/logos/<nn>-<slug>-{mark,lockup}.svg and
// concepts/preview.html (every concept, plus the pick-one-of-two duel).
//
//   node concepts/src/build.mjs
//
// The lockups use klin's current wordmark from brand/src/mark.mjs, read-only,
// so only the marks differ between concepts.

import { mkdirSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { wordmark } from "../../brand/src/mark.mjs"
import { concepts, cursorBlock, dropShape, f } from "./marks.mjs"

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, "..")
const INK = "#141414"

const svg = (viewBox, body, label) => {
  const [, , w, h] = viewBox.split(" ").map(Number)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${f(w)}" height="${f(h)}" role="img" aria-label="${label}"><title>${label}</title>${body}</svg>\n`
}

/** The wordmark, with the i's round dot swapped for something else when asked. */
function word({ dot } = {}) {
  const w = wordmark()
  if (!dot) return w
  const re = /M([\d.]+) (-[\d.]+)A13 13 0 1 1 [\d.]+ -[\d.]+A13 13 0 1 1 [\d.]+ -[\d.]+Z/
  const m = w.d.match(re)
  if (!m) throw new Error("couldn't find the i's dot in the wordmark")
  const cx = Number(m[1]) + 13
  const bottom = Number(m[2]) + 13
  return { ...w, d: w.d.replace(re, dot(cx, bottom)) }
}

/** Mark beside the wordmark: the mark centred on the ascender band, scaled by its longer side. */
function lockup(c, m) {
  const pad = 8
  const asc = 180
  if (c.slug === "cursor") {
    // The cursor follows the word, the way it does at a prompt.
    const w = word()
    const blk = cursorBlock({ w: 92, h: asc })
    const gx = w.width + 26
    const W = gx + blk.w
    const body = `<path fill="${INK}" d="${w.d}" transform="translate(${pad} ${asc + pad})"/><path fill="${INK}" d="${blk.d}" transform="translate(${f(gx + pad)} ${pad})"/>`
    return svg(`0 0 ${f(W + 2 * pad)} ${asc + 2 * pad}`, body, "klin")
  }
  if (c.slug === "droplet") {
    const w = word({ dot: (cx, bottom) => dropShape(cx, bottom - 16, 16) })
    const top = 194 // the drop's corner rises a little over the ascender
    const body = `<path fill="${INK}" d="${w.d}" transform="translate(${pad} ${top + pad})"/>`
    return svg(`0 0 ${f(w.width + 2 * pad)} ${top + 2 * pad}`, body, "klin")
  }
  const [x0, y0, x1, y1] = m.box
  const bw = x1 - x0
  const bh = y1 - y0
  const size = 206 * (c.optical ?? 1)
  const s = size / Math.max(bw, bh)
  const mw = bw * s
  const mh = bh * s
  const w = word()
  const gap = 0.3 * size
  // Baseline at y = 0; the mark centres on the middle of the ascender.
  const cy = -asc / 2
  const top = Math.min(-asc, cy - mh / 2)
  const bottom = Math.max(0, cy + mh / 2)
  const H = bottom - top
  const W = mw + gap + w.width
  const oy = -top + pad
  const body =
    `<path fill="${INK}" d="${m.d}" transform="translate(${f(pad)} ${f(oy + cy - mh / 2)}) scale(${f(s * 1000) / 1000}) translate(${f(-x0)} ${f(-y0)})"/>` +
    `<path fill="${INK}" d="${w.d}" transform="translate(${f(pad + mw + gap)} ${f(oy)})"/>`
  return svg(`0 0 ${f(W + 2 * pad)} ${f(H + 2 * pad)}`, body, "klin")
}

mkdirSync(join(root, "logos"), { recursive: true })
const built = concepts.map((c, i) => {
  const nn = String(i + 1).padStart(2, "0")
  const m = c.mark()
  const markSvg = svg("0 0 256 256", `<path fill="${INK}" d="${m.d}"/>`, `klin concept ${nn}: ${c.name}`)
  const lockSvg = lockup(c, m)
  writeFileSync(join(root, "logos", `${nn}-${c.slug}-mark.svg`), markSvg)
  writeFileSync(join(root, "logos", `${nn}-${c.slug}-lockup.svg`), lockSvg)
  return { ...c, nn, markSvg, lockSvg, d: m.d, box: m.box }
})

// The preview page: the template with the concepts inlined, so it works as a single file.
const strip = (s) => s.replace(/<title>.*?<\/title>/, "").replace(/ width="[\d.]+" height="[\d.]+"/, "").replace(/fill="#141414"/g, 'fill="currentColor"').trim()
const data = built.map((c) => ({
  n: c.nn,
  slug: c.slug,
  name: c.name,
  type: c.type,
  idea: c.idea,
  why: c.why,
  d: c.d,
  mark: strip(c.markSvg),
  lockup: strip(c.lockSvg),
  box: c.box,
  after: c.slug === "cursor",
  inWord: c.slug === "droplet",
}))
const wordPx = readFileSync(join(root, "..", "packages/create-klin/src/ui/logo-art.ts"), "utf8")
const word16 = {}
for (const letter of ["k", "l", "i", "n"]) {
  const block = wordPx.split("const WORD_16")[1].split("const WORD_10")[0]
  if (letter === "l") {
    word16.l = Array(16).fill("##")
    continue
  }
  const m = block.match(new RegExp(`\\b${letter}: \\[([^\\]]*)\\]`))
  word16[letter] = [...m[1].matchAll(/"([.#]+)"/g)].map((x) => x[1])
}
const template = readFileSync(join(here, "preview.html"), "utf8")
// Today's lockup, for the "why" at the top of the page.
const current = strip(readFileSync(join(root, "..", "brand/logo/klin-lockup-mono.svg"), "utf8"))
const html = template
  .replace("<!--{{CURRENT}}-->", current)
  .replace("/*{{DATA}}*/", `const CONCEPTS = ${JSON.stringify(data)};\nconst WORD16 = ${JSON.stringify(word16)};`)
writeFileSync(join(root, "preview.html"), html)
console.log(`wrote ${built.length} concepts → concepts/logos, concepts/preview.html`)
