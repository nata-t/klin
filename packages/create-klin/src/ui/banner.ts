import { setTimeout as sleep } from "node:timers/promises"
import { LOGO } from "./logo"
import { c, colorEnabled, gray, paint, pick, RESET, sgr, sym, unicode } from "./theme"

const TAGLINES = [
  "a spotless full-stack starter",
  "sweeping away boilerplate since 2026",
  "squeaky-clean TypeScript, end to end",
  "fresh monorepo, no dust included",
  "the starter that tidies up after itself",
  "auth, API and UI — already put away neatly",
]

/**
 * One frame of the logo: solid blocks in white, the box-drawing shadow in
 * gray, and a band of light that sweeps diagonally across (`at` 0..1).
 */
function frame(at: number) {
  return LOGO.map((line, row) => {
    let out = "  "
    ;[...line].forEach((char, col) => {
      if (char === " ") {
        out += " "
        return
      }
      const position = (col + row * 2) / (line.length + LOGO.length * 2)
      const glow = Math.max(0, 1 - Math.abs(position - at) * 6)
      const base = char === "█" ? gray.bright - 0x18 : gray.subtle
      const level = Math.round(base + (gray.white - base) * glow)
      out += `${sgr({ fg: [level, level, level] })}${char}`
    })
    return out + RESET
  })
}

/**
 * The big "KLIN" logo. In an interactive terminal a band of light sweeps
 * across it once; everywhere else (CI, pipes, --no-banner, narrow terminals)
 * it's a single line.
 */
export async function banner(version: string, options: { compact?: boolean } = {}) {
  const tagline = pick(TAGLINES)
  const columns = process.stdout.columns ?? 80
  const interactive = process.stdout.isTTY && !process.env.CI

  if (options.compact || !unicode || columns < 44 || !interactive) {
    console.log(`\n  ${c.white(`${sym.star} klin`)} ${c.dim(`v${version}`)} ${c.faint(sym.dot)} ${c.muted(tagline)}\n`)
    return
  }

  console.log()
  const frames = colorEnabled ? 18 : 1
  for (let i = 0; i < frames; i++) {
    const lines = frames > 1 ? frame(-0.2 + (i / (frames - 1)) * 1.4) : LOGO.map((l) => `  ${l}`)
    if (i > 0) process.stdout.write(`\x1b[${lines.length}A`)
    process.stdout.write(lines.map((l) => `\x1b[2K${l}`).join("\n") + "\n")
    if (frames > 1) await sleep(26)
  }
  console.log(`  ${paint(tagline, { fg: "muted" })}  ${c.faint(`v${version}`)}\n`)
}
