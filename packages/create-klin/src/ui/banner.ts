import { setTimeout as sleep } from "node:timers/promises"
import { center } from "./log"
import { HATCH, hatchPose, type LogoPose, logoArt, logoShade } from "./logo"
import { c, colorEnabled, paint, pick, RESET, sgr, sym, unicode } from "./theme"

const TAGLINES = [
  "a spotless full-stack starter",
  "sweeping away boilerplate since 2026",
  "squeaky-clean TypeScript, end to end",
  "fresh monorepo, no dust included",
  "the starter that tidies up after itself",
  "auth, API and UI — already put away neatly",
]

/**
 * One frame of the logo — the egg and the letters in the chrome gradient —
 * posed mid-hatch, with a band of light sweeping diagonally across (`at` 0..1).
 */
function frame(pose: LogoPose | undefined, at: number | null) {
  const art = logoArt(6, pose)
  const rows = logoArt(6).lines.map(() => [...Array(logoArt(6).width + 1)].map(() => " "))
  for (const cell of art.cells) {
    let level = logoShade(cell.kind, cell.row, art.height)
    if (at !== null) {
      const position = (cell.col + cell.row * 2) / (art.width + art.height * 2)
      level = Math.round(level + (0xff - level) * Math.max(0, 1 - Math.abs(position - at) * 6))
    }
    rows[cell.row]![cell.col] = colorEnabled ? `${sgr({ fg: [level, level, level] })}${cell.ch}` : cell.ch
  }
  return rows.map((row) => row.join("").trimEnd() + (colorEnabled ? RESET : ""))
}

/**
 * The klin logo, centered. In an interactive terminal the egg hatches and a
 * band of light sweeps across it once; everywhere else (CI, pipes, --no-banner, narrow
 * terminals) it's a single line.
 */
export async function banner(version: string, options: { compact?: boolean } = {}) {
  const tagline = pick(TAGLINES)
  const columns = process.stdout.columns ?? 80
  const interactive = process.stdout.isTTY && !process.env.CI

  if (options.compact || !unicode || columns < 44 || !interactive) {
    console.log(`\n${center(`${c.white("klin")} ${c.dim(`v${version}`)} ${c.faint(sym.dot)} ${c.muted(tagline)}`)}`)
    return
  }

  console.log()
  // The logo's rows are all one width, so they move right together.
  const pad = " ".repeat(Math.max(2, Math.floor((columns - logoArt(6).width) / 2)))
  const show = (lines: string[], first: boolean) => {
    if (!first) process.stdout.write(`\x1b[${lines.length}A`)
    process.stdout.write(lines.map((l) => `\x1b[2K${pad}${l}`).join("\n") + "\n")
  }
  if (!colorEnabled) show(frame(undefined, null), true)
  else {
    // The egg hatches (a wobble, a crack, the cap pops), then the band of light sweeps across.
    for (const [i, key] of HATCH.entries()) {
      show(frame(hatchPose(6, key.ms), null), i === 0)
      const next = HATCH[i + 1]
      if (next) await sleep(next.ms - key.ms)
    }
    const sweeps = 18
    for (let i = 0; i < sweeps; i++) {
      show(frame(undefined, -0.2 + (i / (sweeps - 1)) * 1.4), false)
      await sleep(26)
    }
  }
  console.log(center(`${paint(tagline, { fg: "muted" })}  ${c.faint(`v${version}`)}`))
}
