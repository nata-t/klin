// Builds every klin brand file into brand/, then copies the ones the website
// and the generated app use into place.
//
//   node brand/src/build.mjs
//
// sharp comes from the website's Astro install; the social cards are
// screenshots from the system Chrome (/usr/bin/google-chrome). The pixel
// favicons are drawn from the CLI's own logo bitmaps
// (packages/create-klin/src/ui/logo-art.ts), so the tab icon and the terminal
// header are the same pixels.
import { execFileSync } from "node:child_process"
import { mkdirSync, readFileSync, rmSync, writeFileSync, copyFileSync } from "node:fs"
import { createRequire } from "node:module"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { f, mark, wordmark } from "./mark.mjs"

const BRAND = join(dirname(fileURLToPath(import.meta.url)), "..")
const REPO = join(BRAND, "..")
const require = createRequire(createRequire(join(REPO, "website/package.json")).resolve("astro/package.json"))
const sharp = require("sharp")
const { PIXEL_MARKS, logoArt } = await import(join(REPO, "packages/create-klin/src/ui/logo-art.ts"))

const out = (path, data) => {
  const file = join(BRAND, path)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, data)
  return file
}

// ── Palette ────────────────────────────────────────────────────────────
// The CLI's grays. The logo is one colour; the app icon is the white mark on the ink tile.
const INK = "#141414"
const WHITE = "#ffffff"
const BRIGHT = "#eeeeee"

// ── Geometry ───────────────────────────────────────────────────────────

const M = mark()
const SMALL = mark({ n: 50, e: 22, rn: 9 }) // the cut for 48 px and below: bigger nodes, thicker wires
const W = wordmark()
const MW = M.box.x1 - M.box.x0
const MH = M.box.y1 - M.box.y0

/** The lockup: the mark, then the wordmark with its ascender at 0.8 of the mark's height, baselines shared. */
const LOCK = (() => {
  const k = (MH * 0.8) / W.asc
  const gap = 52
  const width = MW + gap + W.width * k
  return { k, gap, width, height: MH }
})()

const svg = (w, h, title, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(w)} ${f(h)}" width="${f(w)}" height="${f(h)}" role="img" aria-label="${title}">` +
  `<title>${title}</title>${body}</svg>\n`

const markBody = (fill, m = M) => `<path fill="${fill}" transform="translate(${f(-m.box.x0)} ${f(-m.box.y0)})" d="${m.d}"/>`
const lockupBody = (fill) =>
  markBody(fill) + `<path fill="${fill}" transform="translate(${f(MW + LOCK.gap)} ${f(MH)}) scale(${f(LOCK.k)})" d="${W.d}"/>`

const markSvg = (fill) => svg(MW, MH, "klin", markBody(fill))
const lockupSvg = (fill) => svg(Math.ceil(LOCK.width), MH, "klin", lockupBody(fill))

/** The mark on the ink tile, `fill` of the square; `bleed` drops the rounded corners (iOS and Android round them). */
function icon(size, { fill = 0.62, bleed = false, small = false } = {}) {
  const m = small ? SMALL : M
  const w = m.box.x1 - m.box.x0
  const h = m.box.y1 - m.box.y0
  const k = (size * fill) / h
  const x = (size - w * k) / 2 - m.box.x0 * k
  const y = (size - h * k) / 2 - m.box.y0 * k
  const tile = `<rect width="${size}" height="${size}"${bleed ? "" : ` rx="${f(size * 0.225)}"`} fill="${INK}"/>`
  return svg(size, size, "klin", `${tile}<path fill="${WHITE}" transform="translate(${f(x)} ${f(y)}) scale(${f(k)})" d="${m.d}"/>`)
}

/** A pixel favicon: one of the CLI's bitmaps on the ink tile, pixel-aligned (crisp at its size and at 2×). */
function pixelIcon(size, bitmap) {
  const h = bitmap.length
  const w = bitmap[0].length
  const ox = Math.floor((size - w) / 2)
  const oy = Math.floor((size - h) / 2)
  let d = ""
  bitmap.forEach((line, y) => {
    for (const run of line.matchAll(/[#+]+/g)) d += `M${ox + run.index} ${oy + y}h${run[0].length}v1h-${run[0].length}Z`
  })
  return svg(size, size, "klin", `<rect width="${size}" height="${size}" rx="${f(size * 0.2)}" fill="${INK}"/><path fill="${WHITE}" shape-rendering="crispEdges" d="${d}"/>`)
}

// ── Vector masters ─────────────────────────────────────────────────────

for (const [name, fill] of [["black", INK], ["white", WHITE], ["mono", "currentColor"]]) {
  out(`logo/klin-mark-${name}.svg`, markSvg(fill))
  out(`logo/klin-lockup-${name}.svg`, lockupSvg(fill))
}
out("logo/klin-icon.svg", icon(512))

// ── Rasters ────────────────────────────────────────────────────────────

// Rendered at 4× and scaled down for even edges; pixel icons are rendered 1:1 so they stay sharp.
const png = (source, w, h = w, { opaque = false, crisp = false } = {}) => {
  let img = sharp(Buffer.from(source), { density: crisp ? 72 : 72 * 4 }).resize(w, h, crisp ? { kernel: "nearest" } : {})
  if (opaque) img = img.flatten({ background: INK })
  return img.png({ compressionLevel: 9 }).toBuffer()
}

const fav16 = await png(pixelIcon(16, PIXEL_MARKS[12]), 16, 16, { crisp: true })
const fav32 = await png(pixelIcon(32, PIXEL_MARKS[20]), 32, 32, { crisp: true })
const fav48 = await png(icon(48, { small: true, fill: 0.7 }), 48)
out("favicon/favicon-16x16.png", fav16)
out("favicon/favicon-32x32.png", fav32)
out("favicon/favicon.svg", pixelIcon(16, PIXEL_MARKS[12]))

// favicon.ico: 16 and 32 from the pixel bitmaps, 48 from the small vector cut (stored as PNGs).
{
  const images = [[16, fav16], [32, fav32], [48, fav48]]
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(([size, data], i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size, e)
    header.writeUInt8(size, e + 1)
    header.writeUInt16LE(1, e + 4)
    header.writeUInt16LE(32, e + 6)
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  out("favicon/favicon.ico", Buffer.concat([header, ...images.map(([, data]) => data)]))
}

out("favicon/apple-touch-icon.png", await png(icon(180, { bleed: true, fill: 0.58 }), 180, 180, { opaque: true }))
out("favicon/icon-192.png", await png(icon(192), 192))
out("favicon/icon-512.png", await png(icon(512), 512))
// Maskable: launchers crop to any shape inside the middle 80%.
out("favicon/icon-maskable-512.png", await png(icon(512, { bleed: true, fill: 0.5 }), 512, 512, { opaque: true }))
out(
  "favicon/site.webmanifest",
  JSON.stringify(
    {
      name: "klin",
      short_name: "klin",
      icons: [
        { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
        { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
      theme_color: INK,
      background_color: INK,
      display: "standalone",
    },
    null,
    2,
  ) + "\n",
)

// Lockup PNGs, for places that can't show SVG (the npm README).
const lockW = 1200
const lockH = Math.round((lockW * MH) / Math.ceil(LOCK.width))
out("logo/klin-lockup-black.png", await png(lockupSvg(INK), lockW, lockH))
out("logo/klin-lockup-white.png", await png(lockupSvg(WHITE), lockW, lockH))

// ── Social cards (Chrome screenshots, for real Geist text) ─────────────

const fonts = join(REPO, "website/node_modules/@fontsource-variable")
const fontUrl = (pkg, file) => "file://" + join(fonts, pkg, "files", file)

function card(w, h) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face { font-family: "Geist Mono"; src: url("${fontUrl("geist-mono", "geist-mono-latin-wght-normal.woff2")}") format("woff2"); font-weight: 100 900; }
html, body { margin: 0; width: ${w}px; height: ${h}px; overflow: hidden; }
body {
  background: radial-gradient(120% 90% at 50% 0%, #1c1c1c 0%, #141414 55%, #0e0e0e 100%);
  color: #c4c4c4; font-family: "Geist Mono", monospace; position: relative;
}
/* The mark's grid, faint: package nodes on a lattice, like the logo is drawn on. */
body::before { content: ""; position: absolute; inset: 0; opacity: .5;
  background-image: radial-gradient(circle, rgba(255,255,255,.07) 1.6px, transparent 1.8px); background-size: 40px 40px; background-position: 20px 20px; }
.hud { position: absolute; top: 36px; font: 500 13px/1 "Geist Mono", monospace; letter-spacing: .18em; text-transform: uppercase; color: #6a6a6a; margin: 0; }
.tl { left: 44px; } .tr { right: 44px; }
.stage { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 38px; padding-top: 6px; }
.lock svg { display: block; height: ${Math.round(h * 0.25)}px; width: auto; }
h1 { margin: 0; font: 620 50px/1.05 "Geist Mono", monospace; letter-spacing: -0.045em; text-align: center;
  background: linear-gradient(180deg, #fafafa 10%, #a4a4a4 95%); -webkit-background-clip: text; background-clip: text; color: transparent; }
.cmd { font: 400 20px/1 "Geist Mono", monospace; color: #eeeeee; border: 1px solid #444; border-radius: 7px; padding: 16px 22px; background: #101010; min-width: 420px; }
.cmd span { color: #6a6a6a; margin-right: 14px; }
</style></head><body>
<p class="hud tl">create-klin</p><p class="hud tr">a spotless full-stack typescript starter</p>
<div class="stage"><div class="lock">${lockupSvg(BRIGHT)}</div><h1>Starter kits, snapped together.</h1><div class="cmd"><span>$</span>npm create klin@latest</div></div>
</body></html>`
}

for (const [name, w, h] of [["social/og.png", 1200, 630], ["social/github-social.png", 1280, 640]]) {
  const html = out(`social/.${w}x${h}.html`, card(w, h))
  const target = join(BRAND, name)
  execFileSync("/usr/bin/google-chrome", ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1", `--window-size=${w},${h}`, `--screenshot=${target}`, "--allow-file-access-from-files", "file://" + html], { stdio: "ignore" })
  rmSync(html)
  writeFileSync(target, await sharp(target).flatten({ background: INK }).png({ compressionLevel: 9 }).toBuffer())
}

// ── The brand sheet: one self-contained page, every asset inlined ──────

{
  const types = { svg: "image/svg+xml", png: "image/png", woff2: "font/woff2" }
  const dataUri = (file) => `data:${types[file.split(".").pop()]};base64,${readFileSync(file).toString("base64")}`
  // The terminal logo, coloured like the CLI draws it (nodes and letters bright, wires gray).
  const terminal = (size) => {
    const art = logoArt(size)
    const rows = art.lines.map((line) => [...line.padEnd(art.width)].map((ch) => ({ ch, kind: "" })))
    for (const c of art.cells) rows[c.row][c.col] = { ch: c.ch, kind: c.kind }
    return rows.map((row) => row.map(({ ch, kind }) => (kind ? `<span class="${kind}">${ch}</span>` : ch)).join("")).join("\n")
  }
  const page = readFileSync(join(BRAND, "src/preview.html"), "utf8")
    .replace(/\{\{asset:([^}]+)\}\}/g, (_, p) => dataUri(join(BRAND, p)))
    .replace(/\{\{font:([^}]+)\}\}/g, (_, p) => dataUri(join(fonts, p)))
    .replace(/\{\{inline:([^}]+)\}\}/g, (_, p) => readFileSync(join(BRAND, p), "utf8").trim())
    .replace(/\{\{terminal:(\d+)\}\}/g, (_, size) => terminal(Number(size)))
  out("preview.html", page)
}

// ── Into the app ───────────────────────────────────────────────────────

// The website's public files.
for (const file of ["favicon.svg", "favicon.ico", "apple-touch-icon.png", "icon-192.png", "icon-512.png", "icon-maskable-512.png", "site.webmanifest"])
  copyFileSync(join(BRAND, "favicon", file), join(REPO, "website/public", file))
copyFileSync(join(BRAND, "social/og.png"), join(REPO, "website/public/og.png"))

// The generated app's favicon (both web variants serve apps/web/public).
copyFileSync(join(BRAND, "favicon/favicon.svg"), join(REPO, "template/apps/web/public/favicon.svg"))

// Inline components (currentColor), so the mark takes the color of the text around it.
const viewBox = (w, h) => `0 0 ${f(w)} ${f(h)}`
const astro = (name, w, h, body) => `---
// Generated by brand/src/build.mjs — edit the geometry in brand/src/mark.mjs and rebuild.
interface Props {
  class?: string
  /** Set it when the logo stands alone and needs a name; leave it off when text beside it already says "klin". */
  label?: string
}
const { class: className, label } = Astro.props
---

<svg
  class={className}
  viewBox="${viewBox(w, h)}"
  fill="currentColor"
  role={label ? "img" : undefined}
  aria-label={label}
  aria-hidden={label ? undefined : "true"}
  data-logo="${name}"
>
  ${body.replaceAll(` fill="currentColor"`, "")}
</svg>
`
mkdirSync(join(REPO, "website/src/components/brand"), { recursive: true })
writeFileSync(join(REPO, "website/src/components/brand/KlinMark.astro"), astro("mark", MW, MH, markBody("currentColor")))
writeFileSync(join(REPO, "website/src/components/brand/KlinLockup.astro"), astro("lockup", Math.ceil(LOCK.width), MH, lockupBody("currentColor")))

// The generated app's mark, for its <Logo> (it sits on the app's brand-colored tile).
writeFileSync(
  join(REPO, "template/apps/web/src/components/klin-mark.tsx"),
  `/** The klin mark (a K drawn as a dependency graph). Swap it for your own logo in ./logo.tsx. */
export function KlinMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="${viewBox(MW, MH)}"
      fill="currentColor"
      aria-hidden
    >
      <path
        transform="translate(${f(-M.box.x0)} ${f(-M.box.y0)})"
        d="${M.d}"
      />
    </svg>
  )
}
`,
)

console.log("brand files written to", BRAND)
