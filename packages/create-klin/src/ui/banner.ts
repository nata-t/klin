import { setTimeout as sleep } from "node:timers/promises"
import { center } from "./log"
import { c, colorEnabled, gray, paint, pick, RESET, sgr, sym, unicode } from "./theme"
import { KLIN } from "./wordmark"

const TAGLINES = [
  "a spotless full-stack starter",
  "sweeping away boilerplate since 2026",
  "squeaky-clean TypeScript, end to end",
  "fresh monorepo, no dust included",
  "the starter that tidies up after itself",
  "auth, API and UI — already put away neatly",
]

/**
 * One frame of the KLIN wordmark: solid blocks in white, the box-drawing
 * shadow in gray, and a band of light that sweeps diagonally across (`at`
 * 0..1, or null for the settled logo).
 */
function frame(at: number | null) {
  return KLIN.map((line, row) => {
    let out = ""
    ;[...line].forEach((char, col) => {
      if (char === " ") {
        out += " "
        return
      }
      const position = (col + row * 2) / (line.length + KLIN.length * 2)
      const glow = at === null ? 0 : Math.max(0, 1 - Math.abs(position - at) * 6)
      const base = char === "█" ? gray.bright - 0x18 : gray.subtle
      const level = Math.round(base + (gray.white - base) * glow)
      out += colorEnabled ? `${sgr({ fg: [level, level, level] })}${char}` : char
    })
    return out + (colorEnabled ? RESET : "")
  })
}

/**
 * The big KLIN wordmark, centered, with the tagline under it. In an
 * interactive terminal a band of light sweeps across it once; everywhere
 * else (CI, pipes, --no-banner, narrow terminals) it's a single line.
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
  const pad = " ".repeat(Math.max(2, Math.floor((columns - KLIN[0]!.length) / 2)))
  const frames = colorEnabled ? 18 : 1
  for (let i = 0; i < frames; i++) {
    const lines = frame(frames > 1 ? -0.2 + (i / (frames - 1)) * 1.4 : null)
    if (i > 0) process.stdout.write(`\x1b[${lines.length}A`)
    process.stdout.write(lines.map((l) => `\x1b[2K${pad}${l}`).join("\n") + "\n")
    if (frames > 1) await sleep(26)
  }
  console.log(center(`${paint(tagline, { fg: "muted" })}  ${c.faint(`v${version}`)}`))
}
