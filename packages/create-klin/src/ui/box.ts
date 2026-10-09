import { gradient, padEnd, pc, unicode, width } from "./theme"

const ROUND = { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" }
const ASCII = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" }

/**
 * A rounded box with a gradient border and an optional title in the top edge.
 *
 *   ╭─ ✨ spotless! ──────────╮
 *   │  cd my-app              │
 *   ╰─────────────────────────╯
 */
export function box(lines: string[], options: { title?: string; padding?: number; minWidth?: number } = {}) {
  const g = unicode ? ROUND : ASCII
  const padding = options.padding ?? 2
  const inner = Math.max(
    options.minWidth ?? 0,
    ...lines.map((l) => width(l) + padding * 2),
    options.title ? width(options.title) + 6 : 0
  )
  const edge = (s: string) => gradient(s)

  const titleText = options.title ? ` ${options.title} ` : ""
  const top = options.title
    ? edge(g.tl + g.h) + pc.bold(titleText) + edge(g.h.repeat(Math.max(0, inner - width(titleText) - 1)) + g.tr)
    : edge(g.tl + g.h.repeat(inner) + g.tr)
  const body = lines.map(
    (line) => edge(g.v) + " ".repeat(padding) + padEnd(line, inner - padding * 2) + " ".repeat(padding) + edge(g.v)
  )
  const bottom = edge(g.bl + g.h.repeat(inner) + g.br)
  return ["", ...[top, ...body, bottom].map((l) => `  ${l}`), ""].join("\n")
}

/** Two aligned columns: label in dim, value as-is. */
export function table(rows: Array<[string, string]>, gap = 3) {
  const labelWidth = Math.max(...rows.map(([label]) => width(label)))
  return rows.map(([label, value]) => pc.dim(padEnd(label, labelWidth + gap)) + value)
}
