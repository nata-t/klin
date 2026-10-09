import { setTimeout as sleep } from "node:timers/promises"
import { colorEnabled, gradient, pc, pick, sym, unicode } from "./theme"

const LOGO = [
  "██╗  ██╗██╗     ██╗███╗   ██╗",
  "██║ ██╔╝██║     ██║████╗  ██║",
  "█████╔╝ ██║     ██║██╔██╗ ██║",
  "██╔═██╗ ██║     ██║██║╚██╗██║",
  "██║  ██╗███████╗██║██║ ╚████║",
  "╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝",
]

// Sparkles drift around the logo; positions are [row, column].
const SPARKLES: Array<[number, number, string]> = [
  [0, 32, "✦"],
  [1, 35, "·"],
  [2, 31, "✧"],
  [4, 34, "·"],
  [5, 31, "✦"],
]

const TAGLINES = [
  "a spotless full-stack starter",
  "sweeping away boilerplate since 2026",
  "squeaky-clean TypeScript, end to end",
  "fresh monorepo, no dust included",
  "the starter that tidies up after itself",
  "auth, API and UI — already put away neatly",
]

function frame(offset: number, sparkleOn: number) {
  return LOGO.map((line, row) => {
    let out = "  " + gradient(line, undefined, offset, LOGO[0]!.length + 6)
    for (const [r, col, char] of SPARKLES) {
      if (r !== row) continue
      const pad = col - line.length
      const visible = (col + sparkleOn) % 3 !== 0
      out += " ".repeat(Math.max(1, pad)) + (visible ? pc.dim(char) : " ")
    }
    return out
  })
}

/**
 * The big gradient "KLIN" logo. In an interactive terminal it shimmers for a
 * moment; everywhere else (CI, pipes, --no-banner, narrow terminals) it's a
 * single line.
 */
export async function banner(version: string, options: { compact?: boolean } = {}) {
  const tagline = pick(TAGLINES)
  const columns = process.stdout.columns ?? 80
  const interactive = process.stdout.isTTY && !process.env.CI

  if (options.compact || !unicode || columns < 44 || !interactive) {
    console.log(`\n  ${gradient(`${sym.star} klin`)} ${pc.dim(`v${version}`)} ${pc.dim(sym.dot)} ${pc.dim(tagline)}\n`)
    return
  }

  console.log()
  const frames = colorEnabled ? 14 : 1
  for (let i = 0; i < frames; i++) {
    const lines = frame(i / frames, i)
    if (i > 0) process.stdout.write(`\x1b[${lines.length}A`)
    process.stdout.write(lines.map((l) => `\x1b[2K${l}`).join("\n") + "\n")
    if (frames > 1) await sleep(28)
  }
  console.log(`  ${pc.dim(tagline)}  ${pc.dim(`v${version}`)}\n`)
}
