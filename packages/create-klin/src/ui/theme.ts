/**
 * The klin look: grayscale — white to black — with hierarchy carried by
 * brightness, weight and glyphs instead of hue. The exceptions are a
 * theme-color swatch, which previews the actual color you'll get, and the two
 * status colors: red for errors and amber for warnings, so problems read at a
 * glance.
 *
 * Everything degrades: truecolor → 256 colors (the gray ramp) → 16 colors →
 * plain text (NO_COLOR, pipes, CI logs).
 */

export type Depth = 0 | 16 | 256 | 16_777_216

const env = process.env

function detectDepth(stream: NodeJS.WriteStream = process.stdout): Depth {
  if ("NO_COLOR" in env && env.NO_COLOR !== "") return 0
  const force = env.FORCE_COLOR
  if (force === "0" || force === "false") return 0
  if (force === "3") return 16_777_216
  if (force === "2") return 256
  if (force !== undefined && force !== "") return 16
  if (!stream.isTTY || env.TERM === "dumb") return env.CI ? 16 : 0
  if (/^(truecolor|24bit)$/i.test(env.COLORTERM ?? "")) return 16_777_216
  if (["iTerm.app", "vscode", "WezTerm", "ghostty", "Hyper", "Tabby", "rio"].includes(env.TERM_PROGRAM ?? "")) return 16_777_216
  if (env.WT_SESSION || /kitty|alacritty|foot|ghostty|direct|wezterm/.test(env.TERM ?? "")) return 16_777_216
  if (/256/.test(env.TERM ?? "") || env.TERM_PROGRAM === "Apple_Terminal") return 256
  return 16
}

export const depth: Depth = detectDepth()
export const colorEnabled = depth > 0
export const unicode = process.platform !== "win32" || Boolean(env.WT_SESSION) || env.TERM_PROGRAM === "vscode"

/* ─── Grays ─────────────────────────────────────────────────────────────── */

export type RGB = readonly [number, number, number]

/** The palette, darkest to brightest. Every color in the UI is one of these. */
export const gray = {
  /** the background (a soft vignette around it in truecolor) */
  bg: 0x14,
  /** the input box and the modal */
  bar: 0x1c,
  /** step connectors that are still ahead */
  tint: 0x24,
  /** the highlight under the cursor */
  lift: 0x30,
  /** dashed borders, tree branches, separators */
  line: 0x44,
  /** group labels, quiet hints */
  subtle: 0x6a,
  /** subtitles and secondary text */
  muted: 0x92,
  /** body text */
  text: 0xc4,
  /** headings, snapped labels */
  bright: 0xee,
  white: 0xff,
} as const

export type GrayName = keyof typeof gray
export type Color = GrayName | RGB

/** The status colors — the only hues besides theme swatches. */
export const hue = {
  /** validation errors and failures */
  error: [0xf8, 0x71, 0x71],
  /** risky choices and things that need a look */
  warn: [0xfb, 0xbf, 0x24],
} as const satisfies Record<string, RGB>

export interface Style {
  fg?: Color
  bg?: Color
  bold?: boolean
  dim?: boolean
  italic?: boolean
  underline?: boolean
  strike?: boolean
  inverse?: boolean
}

const toRgb = (color: Color): RGB => (typeof color === "string" ? [gray[color], gray[color], gray[color]] : color)

function ansi256(rgb: RGB): number {
  const [r, g, b] = rgb
  if (Math.abs(r - g) < 10 && Math.abs(g - b) < 10) {
    // The 24-step gray ramp (232–255), plus pure black and white.
    const level = (r + g + b) / 3
    if (level < 4) return 16
    if (level > 247) return 231
    return 232 + Math.min(23, Math.max(0, Math.round((level - 8) / 10)))
  }
  const q = (v: number) => (v < 48 ? 0 : v < 115 ? 1 : Math.min(5, Math.round((v - 35) / 40)))
  return 16 + 36 * q(r) + 6 * q(g) + q(b)
}

/**
 * 16-color terminals get four grays (black, bright black, white and bright
 * white), and the nearest bright color for anything with a hue.
 */
function ansi16(rgb: RGB, background: boolean): number {
  const [r, g, b] = rgb
  const level = (r + g + b) / 3
  let code = level < 0x30 ? 30 : level < 0xa0 ? 90 : level < 0xe0 ? 37 : 97
  if (Math.max(r, g, b) - Math.min(r, g, b) > 60) {
    const on = (v: number) => (v > Math.max(r, g, b) * 0.6 ? 1 : 0)
    code = 90 + on(r) + 2 * on(g) + 4 * on(b)
  }
  return background ? code + 10 : code
}

function colorCode(color: Color, background: boolean): string {
  const rgb = toRgb(color)
  if (depth === 16_777_216) return `${background ? 48 : 38};2;${rgb[0]};${rgb[1]};${rgb[2]}`
  if (depth === 256) return `${background ? 48 : 38};5;${ansi256(rgb)}`
  return String(ansi16(rgb, background))
}

/** The SGR sequence for a style ("" when colors are off). */
export function sgr(style: Style): string {
  if (!colorEnabled) return ""
  const codes: string[] = ["0"]
  if (style.bold) codes.push("1")
  if (style.dim) codes.push("2")
  if (style.italic) codes.push("3")
  if (style.underline) codes.push("4")
  if (style.inverse) codes.push("7")
  if (style.strike) codes.push("9")
  if (style.fg !== undefined) codes.push(colorCode(style.fg, false))
  // 16-color terminals keep their own background: painting one looks worse than none.
  if (style.bg !== undefined && depth >= 256) codes.push(colorCode(style.bg, true))
  return `\x1b[${codes.join(";")}m`
}

export const RESET = "\x1b[0m"

export function paint(text: string, style: Style): string {
  if (!colorEnabled || text === "") return text
  return `${sgr(style)}${text}${RESET}`
}

/**
 * Semantic styles for line output (logs, boxes, help). Meaning comes from
 * brightness and weight — and red/amber for errors and warnings.
 */
export const c = {
  bold: (s: string) => paint(s, { bold: true }),
  bright: (s: string) => paint(s, { fg: "bright" }),
  white: (s: string) => paint(s, { fg: "white", bold: true }),
  text: (s: string) => paint(s, { fg: "text" }),
  muted: (s: string) => paint(s, { fg: "muted" }),
  dim: (s: string) => paint(s, { fg: "subtle" }),
  faint: (s: string) => paint(s, { fg: "line" }),
  /** commands and paths the reader may copy */
  code: (s: string) => paint(s, { fg: "white", underline: false, bold: true }),
  ok: (s: string) => paint(s, { fg: "bright" }),
  info: (s: string) => paint(s, { fg: "muted" }),
  warn: (s: string) => paint(s, { fg: hue.warn, bold: true }),
  error: (s: string) => paint(s, { fg: hue.error, bold: true }),
  /** a little inverted label: ` klin ` */
  badge: (s: string) =>
    depth >= 256 ? paint(` ${s.trim()} `, { fg: "bg", bg: "bright", bold: true }) : paint(` ${s.trim()} `, { inverse: true, bold: true }),
}

/** A static white→gray sweep across `text` (offset 0..1 shifts the highlight). */
export function shimmer(text: string, offset = 0.15): string {
  if (!colorEnabled) return text
  const chars = [...text]
  const span = Math.max(1, chars.length - 1)
  return chars
    .map((char, i) => {
      if (char === " ") return char
      const distance = Math.abs(i / span - offset)
      const level = Math.round(gray.white - Math.min(1, distance * 1.6) * (gray.white - gray.muted))
      return `${sgr({ fg: [level, level, level], bold: true })}${char}`
    })
    .join("") + RESET
}

/* ─── Glyphs ────────────────────────────────────────────────────────────── */

export const sym = {
  check: unicode ? "✓" : "√",
  cross: unicode ? "✖" : "×",
  warn: unicode ? "▲" : "!",
  info: unicode ? "●" : "*",
  diamond: unicode ? "◆" : "*",
  ring: unicode ? "○" : "o",
  dot: unicode ? "·" : "-",
  arrow: unicode ? "→" : "->",
  caret: unicode ? "›" : ">",
  star: unicode ? "✦" : "*",
  bar: unicode ? "│" : "|",
  plus: "+",
  minus: unicode ? "−" : "-",
  tilde: "~",
  block: unicode ? "█" : "#",
}

/* ─── Swatches ──────────────────────────────────────────────────────────── */

/** Parses "#7c3aed" or "oklch(0.432 0.232 292.759)" into sRGB. */
export function parseColor(css: string): RGB | null {
  const hex = /^#([0-9a-f]{6})$/i.exec(css.trim())
  if (hex) {
    const n = Number.parseInt(hex[1]!, 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  const ok = /^oklch\(\s*([\d.]+)(%?)\s+([\d.]+)\s+([\d.]+)/i.exec(css.trim())
  if (!ok) return null
  const l = Number(ok[1]) / (ok[2] ? 100 : 1)
  const chroma = Number(ok[3])
  const angle = (Number(ok[4]) * Math.PI) / 180
  const a = chroma * Math.cos(angle)
  const b = chroma * Math.sin(angle)
  // OKLab → LMS → linear sRGB → sRGB
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ]
  const encode = (v: number) => {
    const x = Math.min(1, Math.max(0, v))
    return Math.round(255 * (x <= 0.0031308 ? 12.92 * x : 1.055 * x ** (1 / 2.4) - 0.055))
  }
  return [encode(linear[0]!), encode(linear[1]!), encode(linear[2]!)]
}

/** A colored square for line output (the only non-gray ink klin uses). */
export function swatch(css: string | undefined): string {
  const rgb = css ? parseColor(css) : null
  if (!rgb || depth < 256) return sym.block
  return paint("■", { fg: rgb })
}

/* ─── Text measuring ────────────────────────────────────────────────────── */

const ANSI = /\x1b\[[0-9;?]*[A-Za-z]/g
export const stripAnsi = (text: string) => text.replace(ANSI, "")

/** Columns a single code point takes: 0 (combining), 1, or 2 (wide/emoji). */
export function charWidth(cp: number): number {
  if (cp === 0xfe0f || cp === 0x200d || (cp >= 0x300 && cp <= 0x36f)) return 0
  return cp >= 0x1f000 ||
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xff00 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6)
    ? 2
    : 1
}

/** Display width: strips ANSI, counts emoji and CJK as two columns. */
export function width(text: string) {
  let w = 0
  for (const char of stripAnsi(text)) w += charWidth(char.codePointAt(0)!)
  return w
}

export const padEnd = (text: string, size: number) => text + " ".repeat(Math.max(0, size - width(text)))

/** Shortens to `max` columns with an ellipsis. */
export function truncate(text: string, max: number) {
  if (width(text) <= max) return text
  let out = ""
  let w = 0
  for (const char of text) {
    const cw = charWidth(char.codePointAt(0)!)
    if (w + cw > max - 1) break
    out += char
    w += cw
  }
  return `${out}…`
}

/** Greedy word wrap to `max` columns. */
export function wrap(text: string, max: number): string[] {
  const lines: string[] = []
  let line = ""
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word
    if (width(next) <= max) line = next
    else {
      if (line) lines.push(line)
      line = width(word) > max ? truncate(word, max) : word
    }
  }
  if (line) lines.push(line)
  return lines
}

export function pick<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!
}
