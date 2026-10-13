import { charWidth, colorEnabled, depth, RESET, sgr, type Style, unicode } from "./theme"

/**
 * An off-screen grid of cells the full-screen UI draws into, then flushes in
 * one write. Drawing is clipped to the canvas, so layouts never have to worry
 * about running off the edge on small terminals.
 */

interface Cell {
  ch: string
  style: Style
  key: string
}

export type Border = "solid" | "dashed" | "heavy" | "none"

const FRAMES: Record<Exclude<Border, "none">, [string, string, string, string, string, string]> = unicode
  ? {
      solid: ["╭", "╮", "╰", "╯", "─", "│"],
      dashed: ["╭", "╮", "╰", "╯", "┄", "┆"],
      heavy: ["┏", "┓", "┗", "┛", "━", "┃"],
    }
  : {
      solid: ["+", "+", "+", "+", "-", "|"],
      dashed: ["+", "+", "+", "+", "-", ":"],
      heavy: ["#", "#", "#", "#", "=", "#"],
    }

const styleKey = (s: Style) =>
  `${String(s.fg)}|${String(s.bg)}|${s.bold ? 1 : 0}${s.dim ? 1 : 0}${s.italic ? 1 : 0}${s.underline ? 1 : 0}${s.strike ? 1 : 0}${s.inverse ? 1 : 0}`

export class Canvas {
  readonly cells: Cell[]
  /** Rows outside [top, bottom) are left alone — for scrolled content. */
  clip: { top: number; bottom: number } | undefined

  constructor(
    readonly width: number,
    readonly height: number,
    base: Style = {}
  ) {
    const key = styleKey(base)
    this.cells = Array.from({ length: width * height }, () => ({ ch: " ", style: base, key }))
  }

  /**
   * A soft vignette: the background lifts a few shades toward the middle and
   * falls off to the edges. Truecolor only — elsewhere it stays flat.
   */
  vignette(center: number, edge: number) {
    if (depth < 16_777_216) return
    const cx = (this.width - 1) / 2
    const cy = (this.height - 1) / 2
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        // Cells are about twice as tall as wide, so stretch y to keep it round.
        const d = Math.min(1, Math.hypot((x - cx) / (cx || 1), ((y - cy) / (cy || 1)) * 0.9))
        const level = Math.round(center + (edge - center) * d * d)
        const cell = this.cells[y * this.width + x]!
        cell.style = { ...cell.style, bg: [level, level, level] }
        cell.key = styleKey(cell.style)
      }
    }
  }

  private put(x: number, y: number, ch: string, style: Style) {
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return
    if (this.clip && (y < this.clip.top || y >= this.clip.bottom)) return
    const cell = this.cells[y * this.width + x]!
    // Text keeps the background beneath it unless it brings its own.
    const merged = style.bg === undefined ? { ...style, bg: cell.style.bg } : style
    cell.ch = ch
    cell.style = merged
    cell.key = styleKey(merged)
  }

  /** Writes `text` at (x, y); returns the column after it. Clipped to `max` columns. */
  text(x: number, y: number, text: string, style: Style = {}, max = Infinity): number {
    let col = x
    for (const ch of text) {
      const w = charWidth(ch.codePointAt(0)!)
      if (w === 0) continue
      if (col - x + w > max) break
      this.put(col, y, ch, style)
      if (w === 2) this.put(col + 1, y, "", style)
      col += w
    }
    return col
  }

  /** Fills a rectangle (background, and optionally a character). */
  fill(x: number, y: number, w: number, h: number, style: Style, ch = " ") {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) this.put(col, row, ch, style)
  }

  hline(x: number, y: number, w: number, style: Style, ch = unicode ? "─" : "-") {
    for (let col = x; col < x + w; col++) this.put(col, y, ch, style)
  }

  /** A rounded (or dashed / heavy) box. `fill` paints the inside. */
  box(x: number, y: number, w: number, h: number, border: Border, style: Style, fill?: Style) {
    if (fill) this.fill(x + 1, y + 1, w - 2, h - 2, fill)
    if (border === "none" || w < 2 || h < 2) return
    const [tl, tr, bl, br, horizontal, vertical] = FRAMES[border]
    this.put(x, y, tl, style)
    this.put(x + w - 1, y, tr, style)
    this.put(x, y + h - 1, bl, style)
    this.put(x + w - 1, y + h - 1, br, style)
    for (let col = x + 1; col < x + w - 1; col++) {
      this.put(col, y, horizontal, style)
      this.put(col, y + h - 1, horizontal, style)
    }
    for (let row = y + 1; row < y + h - 1; row++) {
      this.put(x, row, vertical, style)
      this.put(x + w - 1, row, vertical, style)
    }
  }

  /** One frame: every row positioned absolutely, styles switched only when they change. */
  toAnsi(): string {
    let out = ""
    for (let y = 0; y < this.height; y++) {
      out += `\x1b[${y + 1};1H`
      let current = ""
      for (let x = 0; x < this.width; x++) {
        const cell = this.cells[y * this.width + x]!
        if (cell.ch === "") continue
        if (colorEnabled && cell.key !== current) {
          out += sgr(cell.style)
          current = cell.key
        }
        out += cell.ch
      }
      if (colorEnabled) out += RESET
    }
    return out
  }

  /** Plain text, for tests and debugging. */
  toString(): string {
    const rows: string[] = []
    for (let y = 0; y < this.height; y++) {
      let row = ""
      for (let x = 0; x < this.width; x++) row += this.cells[y * this.width + x]!.ch
      rows.push(row.trimEnd())
    }
    return rows.join("\n")
  }
}
