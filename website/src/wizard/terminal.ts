import type { Canvas } from "@cli/ui/canvas"
import { gray } from "@cli/ui/theme"
import { drawGeometric, FONT_STACK } from "./glyphs"
import { terminalSize } from "./shims/process"
import { type Key, screen } from "./shims/term"

type Rgb = readonly [number, number, number]
type Color = keyof typeof gray | Rgb | undefined

const DEFAULT_FG: Rgb = [gray.text, gray.text, gray.text]
const DEFAULT_BG: Rgb = [gray.bg, gray.bg, gray.bg]

const rgb = (color: Color, fallback: Rgb): Rgb => {
  if (color === undefined) return fallback
  if (typeof color === "string") {
    const v = gray[color]
    return [v, v, v]
  }
  return color
}
const css = ([r, g, b]: Rgb, alpha = 1) => (alpha === 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${alpha})`)

export const key = (name: string, extra: Partial<Key> = {}): Key => ({
  name,
  sequence: name.length === 1 ? name : name === "space" ? " " : "",
  ctrl: false,
  shift: false,
  meta: false,
  ...extra,
})

const KEYMAP: Record<string, string> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Enter: "return",
  Escape: "escape",
  Backspace: "backspace",
  Delete: "delete",
  Home: "home",
  End: "end",
  " ": "space",
}

/**
 * Paints the CLI's cell canvas onto a <canvas>, sized to its container: the
 * column count follows the width (56–120), and the font follows the columns,
 * so the wizard lays itself out exactly as it would in a terminal that size.
 */
export class Terminal {
  readonly canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private cellW = 8
  private cellH = 16
  private dpr = 1
  private last: Canvas | undefined
  onResize?: (columns: number, rows: number) => void

  constructor(
    private host: HTMLElement,
    private input: HTMLTextAreaElement
  ) {
    this.canvas = host.querySelector("canvas")!
    this.ctx = this.canvas.getContext("2d")!
    this.measure()
    new ResizeObserver(() => {
      this.measure()
      screen.paint()
    }).observe(host)
    screen.attach({ draw: (frame) => this.draw(frame) })
    this.listen()
  }

  private measure() {
    const width = this.host.clientWidth
    const narrow = width < 640
    const columns = Math.max(56, Math.min(120, Math.floor(width / 8.6)))
    const rows = narrow ? 40 : 34
    terminalSize.columns = columns
    terminalSize.rows = rows
    this.dpr = Math.min(2, window.devicePixelRatio || 1)
    this.cellW = width / columns
    this.cellH = this.cellW * 2.05
    const height = Math.round(this.cellH * rows)
    this.canvas.style.width = `${width}px`
    this.canvas.style.height = `${height}px`
    this.canvas.width = Math.round(width * this.dpr)
    this.canvas.height = Math.round(height * this.dpr)
    this.onResize?.(columns, rows)
  }

  draw(frame: Canvas) {
    this.last = frame
    const { ctx, dpr } = this
    const w = this.cellW * dpr
    const h = this.cellH * dpr
    const fontPx = (this.cellW / 0.6) * dpr
    ctx.textBaseline = "middle"
    ctx.textAlign = "left"

    // Backgrounds first, merged into runs of the same color.
    for (let y = 0; y < frame.height; y++) {
      let runStart = 0
      let runColor = ""
      for (let x = 0; x <= frame.width; x++) {
        let color = ""
        if (x < frame.width) {
          const cell = frame.cells[y * frame.width + x]!
          const s = cell.style
          color = css(s.inverse ? rgb(s.fg, DEFAULT_FG) : rgb(s.bg, DEFAULT_BG))
        }
        if (color !== runColor) {
          if (runColor) {
            ctx.fillStyle = runColor
            ctx.fillRect(Math.floor(runStart * w), Math.floor(y * h), Math.ceil((x - runStart) * w) + 1, Math.ceil(h) + 1)
          }
          runStart = x
          runColor = color
        }
      }
    }

    // Then glyphs.
    for (let y = 0; y < frame.height; y++) {
      for (let x = 0; x < frame.width; x++) {
        const cell = frame.cells[y * frame.width + x]!
        const ch = cell.ch
        if (ch === "" || ch === " ") continue
        const s = cell.style
        const fg = s.inverse ? rgb(s.bg, DEFAULT_BG) : rgb(s.fg, DEFAULT_FG)
        const color = css(fg, s.dim ? 0.6 : 1)
        const px = x * w
        const py = y * h
        if (drawGeometric(ctx, ch, px, py, w, h, color, dpr)) continue
        ctx.font = `${s.italic ? "italic " : ""}${s.bold ? 650 : 450} ${fontPx}px ${FONT_STACK}`
        ctx.fillStyle = color
        // A glyph keeps to its own cell (two for wide ones), even from a wider fallback font.
        const wide = x + 1 < frame.width && frame.cells[y * frame.width + x + 1]!.ch === ""
        ctx.fillText(ch, px, py + h / 2 + dpr * 0.5, wide ? w * 2 : w)
        if (s.underline) ctx.fillRect(px, py + h - 2 * dpr, w, dpr)
        if (s.strike) ctx.fillRect(px, py + h / 2, w, dpr)
      }
    }
  }

  /** The current frame as plain text, for screen readers. */
  text() {
    if (!this.last) return ""
    const { width, height, cells } = this.last
    const lines: string[] = []
    for (let y = 0; y < height; y++) {
      let line = ""
      for (let x = 0; x < width; x++) line += cells[y * width + x]!.ch
      lines.push(line.trimEnd())
    }
    return lines.filter(Boolean).join("\n")
  }

  focus() {
    this.input.focus({ preventScroll: true })
  }

  private listen() {
    const { input } = this
    this.host.addEventListener("pointerdown", (event) => {
      if ((event.target as HTMLElement).closest("button, a")) return
      event.preventDefault()
      this.focus()
    })
    input.addEventListener("keydown", (event) => {
      const name = KEYMAP[event.key]
      if (event.ctrlKey || event.metaKey || event.altKey) {
        // Leave copy, paste and the browser's own shortcuts alone, but pass ctrl+u / ctrl+w (clear input).
        if (event.ctrlKey && (event.key === "u" || event.key === "w")) {
          event.preventDefault()
          screen.key(key(event.key, { ctrl: true }))
        }
        return
      }
      if (name) {
        event.preventDefault()
        screen.key(key(name, { shift: event.shiftKey }))
      }
    })
    // Printable characters arrive as text input, which works with on-screen keyboards too.
    input.addEventListener("input", () => {
      const text = input.value
      input.value = ""
      for (const ch of text) {
        if (ch === " ") screen.key(key("space"))
        else screen.key({ name: ch.toLowerCase(), sequence: ch, ctrl: false, shift: ch !== ch.toLowerCase(), meta: false })
      }
    })
  }
}
