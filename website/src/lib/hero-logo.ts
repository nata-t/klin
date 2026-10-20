import { type LogoCell, logoArt } from "@cli/ui/logo-art"

/**
 * The hero's pixel art, taken apart from the CLI's big lockup: the egg and
 * the "klin" letters, laid out on one grid as wide as the word. The word sits
 * in the middle rows; the egg (taller and narrower) is centred over it, since
 * the egg comes first and the word hatches out of it.
 */
export function heroLogo() {
  const art = logoArt(10)
  const word = art.cells.filter((c) => c.kind === "word")
  const egg = art.cells.filter((c) => c.kind === "cap" || c.kind === "shell")
  const span = (cells: LogoCell[], key: "col" | "row") => {
    const values = cells.map((c) => c[key])
    return [Math.min(...values), Math.max(...values) + 1] as const
  }
  const [w0, w1] = span(word, "col")
  const [r0, r1] = span(word, "row")
  const [e0, e1] = span(egg, "col")
  const columns = w1 - w0
  const rows = art.height
  const wordTop = Math.floor((rows - (r1 - r0)) / 2)
  const eggLeft = Math.round((columns - (e1 - e0)) / 2)
  return {
    columns,
    rows,
    /** The letters' cells; `part` is 1–4 (k, l, i, n). */
    word: word.map((c) => ({ ...c, col: c.col - w0, row: c.row - r0 + wordTop })),
    /** The egg's cells (cap and shell); `part` is 0. */
    egg: egg.map((c) => ({ ...c, col: c.col - e0 + eggLeft })),
  }
}
