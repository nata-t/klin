import { c, padEnd, unicode, width } from "./theme"

const ROUND = { tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│" }
const ASCII = { tl: "+", tr: "+", bl: "+", br: "+", h: "-", v: "|" }

/**
 * A rounded box with a gray border and an optional title in the top edge,
 * indented two columns (or centered in the terminal).
 *
 *   ╭─ spotless! ─────────────╮
 *   │  cd my-app              │
 *   ╰─────────────────────────╯
 */
export function box(lines: string[], options: { title?: string; padding?: number; minWidth?: number; center?: boolean } = {}) {
  const g = unicode ? ROUND : ASCII
  const padding = options.padding ?? 2
  const inner = Math.max(
    options.minWidth ?? 0,
    ...lines.map((l) => width(l) + padding * 2),
    options.title ? width(options.title) + 6 : 0
  )
  const edge = (s: string) => c.faint(s)

  const titleText = options.title ? ` ${options.title} ` : ""
  const top = options.title
    ? edge(g.tl + g.h) + c.white(titleText) + edge(g.h.repeat(Math.max(0, inner - width(titleText) - 1)) + g.tr)
    : edge(g.tl + g.h.repeat(inner) + g.tr)
  const body = lines.map(
    (line) => edge(g.v) + " ".repeat(padding) + padEnd(line, inner - padding * 2) + " ".repeat(padding) + edge(g.v)
  )
  const bottom = edge(g.bl + g.h.repeat(inner) + g.br)
  const indent = options.center ? Math.max(2, Math.floor(((process.stdout.columns || 80) - inner - 2) / 2)) : 2
  return ["", ...[top, ...body, bottom].map((l) => `${" ".repeat(indent)}${l}`), ""].join("\n")
}

/** Two aligned columns: label in gray, value as-is. */
export function table(rows: Array<[string, string]>, gap = 3) {
  const labelWidth = Math.max(...rows.map(([label]) => width(label)))
  return rows.map(([label, value]) => c.dim(padEnd(label, labelWidth + gap)) + value)
}
