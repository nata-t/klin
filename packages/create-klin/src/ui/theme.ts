import pc from "picocolors"

/**
 * Colors, gradients and glyphs. Everything degrades gracefully: truecolor →
 * 16 colors → plain text (NO_COLOR, dumb terminals, CI logs).
 */

export const colorEnabled = pc.isColorSupported

const env = process.env
export const truecolor =
  colorEnabled &&
  (/^(truecolor|24bit)$/i.test(env.COLORTERM ?? "") ||
    ["iTerm.app", "vscode", "WezTerm", "ghostty", "Hyper"].includes(env.TERM_PROGRAM ?? "") ||
    Boolean(env.WT_SESSION) ||
    /kitty|alacritty|foot|ghostty|direct/.test(env.TERM ?? ""))

export const unicode = process.platform !== "win32" || Boolean(env.WT_SESSION) || env.TERM_PROGRAM === "vscode"

type RGB = [number, number, number]

const hex = (value: string): RGB => {
  const n = Number.parseInt(value.replace("#", ""), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** The klin palette: mint → sky → violet → pink. */
export const BRAND: RGB[] = ["#5eead4", "#38bdf8", "#a78bfa", "#f472b6"].map(hex)

export function rgb([r, g, b]: RGB, text: string) {
  if (!colorEnabled) return text
  if (!truecolor) return pc.magenta(text)
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`
}

function mix(stops: RGB[], t: number): RGB {
  const clamped = Math.min(1, Math.max(0, t))
  const scaled = clamped * (stops.length - 1)
  const i = Math.min(Math.floor(scaled), stops.length - 2)
  const f = scaled - i
  const a = stops[i]!
  const b = stops[i + 1]!
  return [0, 1, 2].map((k) => Math.round(a[k]! + (b[k]! - a[k]!) * f)) as RGB
}

/**
 * Paints `text` with a left-to-right gradient. `offset` (0..1) shifts the
 * gradient, which is how the banner shimmers.
 */
export function gradient(text: string, stops: RGB[] = BRAND, offset = 0, width?: number) {
  if (!colorEnabled) return text
  const chars = [...text]
  const span = Math.max(1, (width ?? chars.length) - 1)
  if (!truecolor) {
    const cycle = [pc.cyan, pc.blue, pc.magenta, pc.magenta]
    return chars.map((c, i) => (c === " " ? c : cycle[Math.floor((i / span) * (cycle.length - 1))]!(c))).join("")
  }
  return chars
    .map((char, i) => {
      if (char === " ") return char
      let t = i / span + offset
      t = t - Math.floor(t)
      // Ping-pong so the colors flow back and forth instead of jumping.
      const [r, g, b] = mix(stops, t < 0.5 ? t * 2 : (1 - t) * 2)
      return `\x1b[38;2;${r};${g};${b}m${char}`
    })
    .join("") + "\x1b[39m"
}

export const brand = (text: string) => gradient(text)
export const accent = (text: string) => rgb(BRAND[2]!, text)
export const mint = (text: string) => rgb(BRAND[0]!, text)

export const sym = {
  check: unicode ? "✔" : "√",
  cross: unicode ? "✖" : "×",
  warn: unicode ? "▲" : "!",
  info: unicode ? "●" : "*",
  arrow: unicode ? "→" : "->",
  dot: unicode ? "·" : "-",
  sparkle: unicode ? "✨" : "*",
  star: unicode ? "✦" : "*",
  broom: unicode ? "🧹" : "",
  bar: unicode ? "│" : "|",
  plus: "+",
  tilde: "~",
  minus: "-",
}

/** Truecolor swatch for the accent picker. */
export function swatch(hexColor: string) {
  if (!colorEnabled) return "■"
  if (!truecolor) return pc.magenta("■")
  return rgb(hex(hexColor), "■")
}

const ANSI = /\x1b\[[0-9;]*m/g
export const stripAnsi = (text: string) => text.replace(ANSI, "")

/** Display width: strips ANSI, counts emoji and CJK as two columns. */
export function width(text: string) {
  let w = 0
  for (const char of stripAnsi(text)) {
    const cp = char.codePointAt(0)!
    if (cp === 0xfe0f || (cp >= 0x300 && cp <= 0x36f) || cp === 0x200d) continue
    w += cp >= 0x1f000 || (cp >= 0x1100 && cp <= 0x115f) || (cp >= 0x2e80 && cp <= 0xa4cf) || (cp >= 0xac00 && cp <= 0xd7a3) || (cp >= 0xff00 && cp <= 0xff60) ? 2 : 1
  }
  return w
}

export const padEnd = (text: string, size: number) => text + " ".repeat(Math.max(0, size - width(text)))

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}

export { pc }
