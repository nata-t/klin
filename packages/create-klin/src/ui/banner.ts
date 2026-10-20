import { setTimeout as sleep } from "node:timers/promises"
import { center } from "./log"
import { HATCH, hatchPose, type LogoPose, logoArt, logoShade, MARK_WIDTH } from "./logo"
import { c, colorEnabled, paint, pick, RESET, sgr, sym, unicode, width } from "./theme"

const TAGLINES = [
  "a spotless full-stack starter",
  "sweeping away boilerplate since 2026",
  "squeaky-clean TypeScript, end to end",
  "fresh monorepo, no dust included",
  "the starter that tidies up after itself",
  "auth, API and UI — already put away neatly",
]

/**
 * One frame of the small egg, three rows of five cells, in the chrome
 * gradient — posed mid-hatch, with a band of light crossing it (`at` 0..1).
 */
function egg(pose: LogoPose | undefined, at: number | null) {
  const art = logoArt(3, pose)
  const rows = [0, 1, 2].map(() => Array<string>(MARK_WIDTH).fill(" "))
  for (const cell of art.cells) {
    if (cell.kind === "text" || cell.col >= MARK_WIDTH) continue
    let level = logoShade(cell.kind, cell.row, art.height)
    if (at !== null) {
      const position = (cell.col + cell.row * 2) / (MARK_WIDTH + art.height * 2)
      level = Math.round(level + (0xff - level) * Math.max(0, 1 - Math.abs(position - at) * 3))
    }
    rows[cell.row]![cell.col] = colorEnabled ? `${sgr({ fg: [level, level, level] })}${cell.ch}` : cell.ch
  }
  return rows.map((row) => row.join("") + (colorEnabled ? RESET : ""))
}

/**
 * The klin banner: the small egg, with the name and the version beside it
 * and the tagline under them, centered. In an interactive terminal the egg
 * hatches and a band of light crosses it once; everywhere else (CI, pipes,
 * --no-banner, narrow terminals) it's a single line.
 */
export async function banner(version: string, options: { compact?: boolean } = {}) {
  const tagline = pick(TAGLINES)
  const columns = process.stdout.columns ?? 80
  const interactive = process.stdout.isTTY && !process.env.CI

  if (options.compact || !unicode || columns < 44 || !interactive) {
    console.log(`\n${center(`${c.white("klin")} ${c.dim(`v${version}`)} ${c.faint(sym.dot)} ${c.muted(tagline)}`)}`)
    return
  }

  const beside = ["", `${c.white("klin")} ${c.faint(`v${version}`)}`, paint(tagline, { fg: "muted" })]
  const blockW = MARK_WIDTH + 3 + Math.max(width(`klin v${version}`), width(tagline))
  const pad = " ".repeat(Math.max(2, Math.floor((columns - blockW) / 2)))
  const show = (rows: string[], first: boolean) => {
    if (!first) process.stdout.write(`\x1b[${rows.length}A`)
    process.stdout.write(rows.map((row, i) => `\x1b[2K${pad}${row}   ${beside[i]}`).join("\n") + "\n")
  }
  console.log()
  if (!colorEnabled) show(egg(undefined, null), true)
  else {
    // The egg hatches (a wobble, a crack, the cap pops), then the band of light sweeps across.
    for (const [i, key] of HATCH.entries()) {
      show(egg(hatchPose(3, key.ms), null), i === 0)
      const next = HATCH[i + 1]
      if (next) await sleep(next.ms - key.ms)
    }
    const sweeps = 14
    for (let i = 0; i < sweeps; i++) {
      show(egg(undefined, -0.2 + (i / (sweeps - 1)) * 1.4), false)
      await sleep(26)
    }
  }
}
