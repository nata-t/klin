import type { Canvas } from "./canvas"
import { colorEnabled, type Style, unicode } from "./theme"

/** "KLIN" in ANSI Shadow — the banner, the full-screen header and the generated app's hero use it. */
export const LOGO = [
  "██╗  ██╗██╗     ██╗███╗   ██╗",
  "██║ ██╔╝██║     ██║████╗  ██║",
  "█████╔╝ ██║     ██║██╔██╗ ██║",
  "██╔═██╗ ██║     ██║██║╚██╗██║",
  "██║  ██╗███████╗██║██║ ╚████║",
  "╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝",
]

/**
 * The same letters drawn taller — seven rows of face instead of five, the
 * diagonals of K and N stretched to match — for the full-screen header when
 * there's room.
 */
const TALL_LOGO = [
  "██╗   ██╗██╗     ██╗███╗     ██╗",
  "██║  ██╔╝██║     ██║████╗    ██║",
  "██║ ██╔╝ ██║     ██║██╔██╗   ██║",
  "█████╔╝  ██║     ██║██║╚██╗  ██║",
  "██╔═██╗  ██║     ██║██║ ╚██╗ ██║",
  "██║  ██╗ ██║     ██║██║  ╚██╗██║",
  "██║   ██╗███████╗██║██║   ╚████║",
  "╚═╝   ╚═╝╚══════╝╚═╝╚═╝    ╚═══╝",
]

/**
 * The same letters at half the height, for shorter terminals: every two rows
 * of solid blocks fold into one row of ▀ ▄ █.
 *
 *   ██  ▄█▀ ██      ██ ███▄   ██
 *   ██▀▀█▄  ██      ██ ██ ▀█▄ ██
 *   ▀▀   ▀▀ ▀▀▀▀▀▀▀ ▀▀ ▀▀   ▀▀▀▀
 */
export const MINI_LOGO: string[] = (() => {
  const solid = (row: number, col: number) => LOGO[row]?.[col] === "█"
  const rows: string[] = []
  for (let row = 0; row < LOGO.length; row += 2) {
    let line = ""
    for (let col = 0; col < LOGO[0]!.length; col++) {
      const top = solid(row, col)
      const bottom = solid(row + 1, col)
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " "
    }
    rows.push(line.trimEnd())
  }
  return rows
})()

/** One line, for when the screen is short: ✦ K L I N ✦ */
const WORDMARK = "K L I N"

/** How many rows the header logo takes: tall letters, the regular ones, folded ones, or one line. */
export type LogoSize = 8 | 6 | 3 | 1

const ART: Record<LogoSize, string[]> = { 8: TALL_LOGO, 6: LOGO, 3: MINI_LOGO, 1: [WORDMARK] }
const ART_WIDTH = (size: LogoSize) => Math.max(...ART[size].map((line) => line.length))

/**
 * Sparkles around the logo, mirrored loosely on both sides so it stays
 * centered: [row, columns away from the letters, glyph, brightness].
 */
type Sparkle = [row: number, away: number, glyph: string, level: number]
const SPARKLES: Record<LogoSize, { left: Sparkle[]; right: Sparkle[] }> = {
  8: {
    left: [
      [1, 3, "✦", 0xb4],
      [4, 6, "·", 0x6a],
      [6, 2, "·", 0x52],
    ],
    right: [
      [0, 3, "✦", 0xe0],
      [2, 6, "·", 0x6a],
      [3, 2, "✧", 0x92],
      [5, 5, "·", 0x6a],
      [7, 2, "✦", 0x7c],
    ],
  },
  6: {
    left: [
      [1, 3, "✦", 0xb4],
      [3, 6, "·", 0x6a],
      [4, 2, "·", 0x52],
    ],
    right: [
      [0, 3, "✦", 0xe0],
      [1, 6, "·", 0x6a],
      [2, 2, "✧", 0x92],
      [4, 5, "·", 0x6a],
      [5, 2, "✦", 0x7c],
    ],
  },
  3: {
    left: [
      [0, 3, "·", 0x6a],
      [1, 2, "✦", 0x9c],
    ],
    right: [
      [0, 2, "✦", 0xd4],
      [1, 4, "·", 0x6a],
      [2, 2, "✧", 0x80],
    ],
  },
  1: { left: [[0, 2, "✦", 0x92]], right: [[0, 2, "✦", 0x92]] },
}

/** Columns the logo needs, sparkles included. */
export function logoWidth(size: LogoSize) {
  const reach = (side: Sparkle[]) => Math.max(0, ...side.map(([, away]) => away + 1))
  return ART_WIDTH(size) + reach(SPARKLES[size].left) + reach(SPARKLES[size].right)
}

/** The largest logo that fits in `rows` × `columns` (the one-liner always "fits"). */
export function logoSizeFor(rows: number, columns: number): LogoSize {
  if (unicode && rows >= 8 && columns >= logoWidth(8) + 4) return 8
  if (unicode && rows >= 6 && columns >= logoWidth(6) + 4) return 6
  if (unicode && rows >= 3 && columns >= logoWidth(3) + 4) return 3
  return 1
}

/* ─── The intro sweep ──────────────────────────────────────────────────── */

const INTRO_MS = 900
let introStart = 0

/** Starts the one-time sweep of light across the logo (the screen repaints while it runs). */
export function playIntro() {
  if (colorEnabled) introStart = Date.now()
}

export const introRunning = () => introStart > 0 && Date.now() - introStart < INTRO_MS

/**
 * Where the band of light is (0..1 across the letters), or null once it has
 * passed — the settled logo has no band, so the sweep ends without a jump.
 */
function band(): { at: number; frame: number } | null {
  if (!introRunning()) return null
  const t = (Date.now() - introStart) / INTRO_MS
  return { at: -0.3 + t * 1.6, frame: Math.floor((Date.now() - introStart) / 90) }
}

/* ─── Drawing ──────────────────────────────────────────────────────────── */

const level = (n: number): Style["fg"] => [n, n, n]

/**
 * Draws the logo centered in [x, x + w) from row `y`: solid faces in a chrome
 * gradient (white at the top, silver at the bottom), the box-drawing shadow
 * in dark gray for depth, and a few sparkles around it.
 */
export function drawLogo(canvas: Canvas, x: number, w: number, y: number, size: LogoSize) {
  const art = ART[size]
  const artW = ART_WIDTH(size)
  const left = x + Math.floor((w - artW) / 2)
  const light = band()
  // The gradient runs over the rows with solid faces (not the shadow-only bottom row).
  const faceRows = Math.max(1, art.filter((line) => /[█▀▄]/.test(line)).length)

  art.forEach((line, row) => {
    ;[...line].forEach((char, col) => {
      if (char === " ") return
      const face = char === "█" || char === "▀" || char === "▄" || size === 1
      // Chrome: bright on top, falling to silver toward the bottom row of faces.
      let shade = face ? Math.round(0xfa - (0xfa - 0xa4) * Math.min(1, row / Math.max(1, faceRows - 1))) : 0x58
      if (light) {
        const position = (col + row * 2) / (artW + art.length * 2)
        const glow = Math.max(0, 1 - Math.abs(position - light.at) * 6)
        shade = Math.round(shade + (0xff - shade) * glow)
      }
      canvas.text(left + col, y + row, char, { fg: level(shade), bold: size === 1 })
    })
  })

  if (!unicode) return
  const sparkle = ([row, away, glyph, brightness]: Sparkle, col: number, i: number) => {
    // While the light sweeps, the sparkles twinkle.
    if (light && (light.frame + i) % 3 === 0) return
    canvas.text(col, y + row, glyph, { fg: level(brightness) })
  }
  SPARKLES[size].left.forEach((s, i) => sparkle(s, left - s[1] - 1, i))
  SPARKLES[size].right.forEach((s, i) => sparkle(s, left + artW + s[1], i + 1))
}
