import { screen } from "./term"
import { c, sym, width } from "./theme"

/**
 * Every command's output, centered in the terminal like the full-screen pages,
 * in grays:
 *
 *                       klin add   my-app
 *
 *               ✓  Rendering before & after 0.3s
 *
 *                ◆  Adding Organizations & RBAC
 *               ℹ  Added to .env: RESEND_API_KEY
 *
 *                          All tidy.
 *
 * Every call closes the full-screen UI first, so lines land in the scrollback.
 */

/** Whether the last line written here was empty: parts that open with a gap don't double it. */
let gap = false

function write(lines: string[]) {
  screen.close()
  const out = gap && lines[0] === "" ? lines.slice(1) : lines
  if (!out.length) return
  process.stdout.write(`${out.join("\n")}\n`)
  gap = out.at(-1) === ""
}

const columns = () => process.stdout.columns || 80

/** `line` with the spaces in front that center it in the terminal. */
export function center(line: string) {
  return line ? " ".repeat(Math.max(0, Math.floor((columns() - width(line)) / 2))) + line : ""
}

/** Lines centered in the terminal, each on its own. */
export function centered(lines: string[]) {
  write(lines.map(center))
}

/** Lines moved right together, so a tree or a table sits centered and keeps its own alignment. */
export function centeredBlock(lines: string[]) {
  const pad = " ".repeat(Math.max(0, Math.floor((columns() - Math.max(0, ...lines.map(width))) / 2)))
  write(lines.map((line) => (line ? pad + line : "")))
}

/** Lines already laid out, like a box, as they are. */
export function block(text: string) {
  write(text.split("\n"))
}

/** `icon  message`; a message over several lines is centered as a block, the rest under the first line's text. */
function print(icon: string, message: string, around: string[] = []) {
  const [first = "", ...rest] = message.split("\n")
  const lines = [`${icon}  ${first}`, ...rest.map((line) => (line ? `   ${line}` : ""))]
  if (rest.length) centeredBlock([...around, ...lines, ...around])
  else centered([...around, ...lines, ...around])
}

export const log = {
  /** A new part of the output, with a gap above and below. */
  step: (message: string) => print(c.bright(sym.diamond), message, [""]),
  info: (message: string) => print(c.muted(sym.info), message),
  success: (message: string) => print(c.bright(sym.check), message),
  warn: (message: string) => print(c.warn(sym.warn), message),
  error: (message: string) => print(c.error(sym.cross), message),
}

/** ` klin add   my-app` — the badge line a command's output opens with. */
export function intro(title: string, subtitle = "") {
  centered(["", subtitle ? `${c.badge(title)}  ${c.muted(subtitle)}` : c.badge(title), ""])
}

/** The last word, with any notes about what was just set up above it. */
export function outro(message: string, notes: string[] = []) {
  centered(["", ...notes.map((note) => `${c.muted(sym.info)}  ${note}`), ...(notes.length ? [""] : []), message, ""])
}

/** Why a command stopped: an error, or a cancelled prompt. */
export function cancel(message: string) {
  const lines = ["", ...message.split("\n"), ""]
  if (lines.length > 3) centeredBlock(lines)
  else centered(lines)
}
