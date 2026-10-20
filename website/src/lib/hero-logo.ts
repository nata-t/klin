import { Canvas } from "@cli/ui/canvas"
import { drawWordmark, wordmarkWidth } from "@cli/ui/wordmark"
import { MARK_PATHS } from "../components/brand/mark-paths"

/**
 * The hero's art on one grid of square pixels: the egg (the vector mark,
 * rasterized) and the KLIN wordmark the CLI draws — its ANSI Shadow letters,
 * the box-drawing shadow that echoes them down and to the right, and the
 * sparkles around them. Every terminal cell of the wordmark is SX × SY
 * pixels (a cell is about twice as tall as it is wide), so the letters' solid
 * faces become small pixels that can fly, while the shadow glyphs and the
 * sparkles stay whole cells.
 */

export const SX = 2
export const SY = 4
/** The wordmark's regular size: six rows of letters and shadow. */
const SIZE = 6
/** The egg's height, in pixels; it stands taller than the letters it hatches into. */
const EGG_PX = 30
const MARGIN = 2

export const HERO_GRID = (() => {
  /** The wordmark's columns, sparkles included (and a spare on each side). */
  const cells = wordmarkWidth(SIZE) + 2
  const columns = cells * SX
  const rows = Math.max(SIZE * SY, EGG_PX) + MARGIN * 2
  const eggScale = EGG_PX / MARK_PATHS.height
  const eggW = MARK_PATHS.width * eggScale
  return {
    cells,
    columns,
    rows,
    /** The wordmark's top row, in pixels: centred. */
    top: Math.round((rows - SIZE * SY) / 2),
    egg: { scale: eggScale, x: Math.round((columns - eggW) / 2), y: Math.round((rows - EGG_PX) / 2) },
  }
})()

/** Letter boundaries in the wordmark's own columns: K, L, I, N. */
const PART_STARTS = [0, 8, 16, 19]

export interface WordmarkCell {
  /** Where it sits, in pixels. */
  col: number
  row: number
  ch: string
  kind: "face" | "shadow" | "spark"
  /** Its gray in the CLI's drawing. */
  level: number
  /** 1–4 for K, L, I, N; 0 for a sparkle. */
  part: number
}

/** The KLIN wordmark as the CLI draws it at the regular size, cell by cell, placed on the grid. */
export function wordmarkCells(): WordmarkCell[] {
  const { cells, top } = HERO_GRID
  const art = new Canvas(cells, SIZE)
  drawWordmark(art, 0, cells, 0, SIZE)
  const raw: Omit<WordmarkCell, "part">[] = []
  for (let row = 0; row < SIZE; row++)
    for (let col = 0; col < cells; col++) {
      const cell = art.cells[row * cells + col]!
      if (cell.ch === " " || cell.ch === "") continue
      const fg = cell.style.fg
      const kind = cell.ch === "█" ? "face" : "✦✧·".includes(cell.ch) ? "spark" : "shadow"
      raw.push({ col: col * SX, row: top + row * SY, ch: cell.ch, kind, level: Array.isArray(fg) ? fg[0] : 0xc4 })
    }
  const left = Math.min(...raw.filter((c) => c.kind !== "spark").map((c) => c.col))
  return raw.map((c) => {
    if (c.kind === "spark") return { ...c, part: 0 }
    const rel = (c.col - left) / SX
    let part = 1
    PART_STARTS.forEach((start, i) => {
      if (rel >= start) part = i + 1
    })
    return { ...c, part }
  })
}

export interface EggPixel {
  col: number
  row: number
  kind: "cap" | "shell"
}

/** The egg, rasterized: a pixel is the cap's or the shell's where the shape covers at least half of it. Browser only. */
export function eggPixels(): EggPixel[] {
  const S = 4
  const { columns, rows, egg } = HERO_GRID
  const canvas = document.createElement("canvas")
  canvas.width = columns * S
  canvas.height = rows * S
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!
  const coverage = (path: string) => {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.setTransform(S, 0, 0, S, 0, 0)
    ctx.translate(egg.x, egg.y)
    ctx.scale(egg.scale, egg.scale)
    ctx.translate(MARK_PATHS.x, MARK_PATHS.y)
    ctx.fill(new Path2D(path))
    const alpha = ctx.getImageData(0, 0, canvas.width, canvas.height).data
    return (col: number, row: number) => {
      let sum = 0
      for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) sum += alpha[((row * S + y) * canvas.width + col * S + x) * 4 + 3]!
      return sum / (S * S * 255)
    }
  }
  const cap = coverage(MARK_PATHS.cap)
  const shell = coverage(MARK_PATHS.shell)
  const pixels: EggPixel[] = []
  for (let row = 0; row < rows; row++)
    for (let col = 0; col < columns; col++) {
      if (cap(col, row) >= 0.5) pixels.push({ col, row, kind: "cap" })
      else if (shell(col, row) >= 0.5) pixels.push({ col, row, kind: "shell" })
    }
  return pixels
}
