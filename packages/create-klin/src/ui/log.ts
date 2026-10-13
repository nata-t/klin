import { screen } from "./term"
import { c, sym, unicode, width } from "./theme"

/**
 * Line output with a quiet rail down the left, in grays:
 *
 *    klin add   my-app
 *   │
 *   ◆  Adding Organizations & RBAC
 *   ●  Added to .env: RESEND_API_KEY
 *   └  All tidy.
 *
 * Every call closes the full-screen UI first, so lines land in the scrollback.
 */

const rail = unicode ? "│" : "|"
const end = unicode ? "└" : "`"

function print(icon: string, message: string) {
  screen.close()
  const [first = "", ...rest] = message.split("\n")
  const lines = [c.faint(rail), `${icon}  ${first}`, ...rest.map((line) => `${c.faint(rail)}  ${line}`)]
  process.stdout.write(`${lines.join("\n")}\n`)
}

export const log = {
  step: (message: string) => print(c.bright(sym.diamond), message),
  info: (message: string) => print(c.muted(sym.info), message),
  success: (message: string) => print(c.bright(sym.check), message),
  warn: (message: string) => print(c.warn(sym.warn), message),
  error: (message: string) => print(c.error(sym.cross), message),
  message: (message: string) => print(c.faint(rail), message),
}

/** `  klin add   my-app` — the header of a command's output. */
export function intro(title: string, subtitle = "") {
  screen.close()
  process.stdout.write(`\n  ${c.badge(title)}  ${c.muted(subtitle)}\n`)
}

/** Lines centered in the terminal — the end of the wizard, whose pages are centered too. */
export function centered(lines: string[]) {
  screen.close()
  const columns = process.stdout.columns || 80
  const pad = (line: string) => (line ? " ".repeat(Math.max(0, Math.floor((columns - width(line)) / 2))) + line : "")
  process.stdout.write(`${lines.map(pad).join("\n")}\n`)
}

export function outro(message: string) {
  screen.close()
  process.stdout.write(`${c.faint(rail)}\n${c.faint(end)}  ${message}\n\n`)
}

export function cancel(message: string) {
  screen.close()
  process.stdout.write(`${c.faint(rail)}\n${c.faint(end)}  ${message}\n\n`)
}
