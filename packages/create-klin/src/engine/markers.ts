import { evaluate, identifiers, type FlagSet } from "./expr"

/**
 * Template markers — the whole "strip what you didn't pick" engine.
 *
 * Directives live in a comment on their own line, in whatever comment syntax the
 * file uses (`//`, `#`, `/* *\/`, `{/* *\/}`, `<!-- -->`, `--`):
 *
 *   // klin:if google || github      start a conditional block
 *   // klin:elif magic-link          ...else-if
 *   // klin:else                     ...else
 *   // klin:endif                    end the block
 *   // klin:file organizations       keep this whole file only if true
 *
 * Single lines can carry a trailing condition:
 *
 *   <GoogleButton />  {/* klin:only google *\/}
 *
 * Mutually exclusive variants (e.g. databases) keep the template runnable by
 * writing the non-default variants as *dormant* lines, which are uncommented
 * when their branch is picked:
 *
 *   // klin:if postgres
 *   provider = "postgresql"
 *   // klin:elif sqlite
 *   //? provider = "sqlite"
 *   // klin:endif
 *
 * Dormant prefixes: `//? `, `#? `, `/*? … *\/`, `{/*? … *\/}`.
 */

const OPEN = String.raw`(?:\/\/|#|\{\/\*|\/\*|<!--|--)`
const CLOSE = String.raw`(?:\*\/\}|\*\/|-->)`

const DIRECTIVE = new RegExp(
  String.raw`^\s*${OPEN}\s*klin:(if|elif|else|endif|file)\b\s*(.*?)\s*${CLOSE}?\s*$`
)
const INLINE = new RegExp(
  String.raw`^(.*?)\s*${OPEN}\s*klin:only\s+(.+?)\s*${CLOSE}?\s*$`
)
const DORMANT_LINE = /^(\s*)(?:\/\/|#)\? ?(.*)$/
const DORMANT_BLOCK = /^(\s*)\/\*\? ?(.*?) ?\*\/\s*$/
const DORMANT_JSX = /^(\s*)\{\/\*\? ?(.*?) ?\*\/\}\s*$/

export class MarkerError extends Error {
  constructor(message: string, readonly file: string, readonly line: number) {
    super(`${file}:${line} — ${message}`)
    this.name = "MarkerError"
  }
}

/** Fast check so files without markers are passed through byte-for-byte. */
export function hasMarkers(text: string): boolean {
  return text.includes("klin:")
}

interface Frame {
  parentActive: boolean
  taken: boolean
  active: boolean
  line: number
}

const GAP = Symbol("gap")

/**
 * Applies markers to `text`. Returns `null` when a `klin:file` pragma excludes
 * the file. Throws `MarkerError` on malformed blocks or unknown flags.
 */
export function processMarkers(
  text: string,
  flags: FlagSet,
  file = "<template>"
): string | null {
  if (!hasMarkers(text)) return text

  const endsWithNewline = text.endsWith("\n")
  const lines = text.replace(/\r\n/g, "\n").split("\n")
  if (endsWithNewline) lines.pop()

  const out: Array<string | typeof GAP> = []
  const stack: Frame[] = []
  const isActive = () => stack.length === 0 || stack[stack.length - 1]!.active

  const check = (expr: string, lineNo: number): boolean => {
    try {
      return evaluate(expr, flags)
    } catch (error) {
      throw new MarkerError((error as Error).message, file, lineNo)
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const lineNo = i + 1
    const directive = DIRECTIVE.exec(line)

    if (directive) {
      const [, kind, rawExpr = ""] = directive
      const expr = rawExpr.trim()
      const top = stack[stack.length - 1]

      switch (kind) {
        case "file": {
          if (!expr) throw new MarkerError("klin:file needs an expression", file, lineNo)
          if (!check(expr, lineNo)) return null
          continue
        }
        case "if": {
          if (!expr) throw new MarkerError("klin:if needs an expression", file, lineNo)
          const parentActive = isActive()
          const cond = check(expr, lineNo) && parentActive
          stack.push({ parentActive, taken: cond, active: cond, line: lineNo })
          break
        }
        case "elif": {
          if (!top) throw new MarkerError("klin:elif without klin:if", file, lineNo)
          if (!expr) throw new MarkerError("klin:elif needs an expression", file, lineNo)
          const cond = check(expr, lineNo) && top.parentActive && !top.taken
          top.active = cond
          top.taken ||= cond
          break
        }
        case "else": {
          if (!top) throw new MarkerError("klin:else without klin:if", file, lineNo)
          top.active = top.parentActive && !top.taken
          top.taken = true
          break
        }
        case "endif": {
          if (!top) throw new MarkerError("klin:endif without klin:if", file, lineNo)
          stack.pop()
          break
        }
      }
      out.push(GAP)
      continue
    }

    if (!isActive()) {
      out.push(GAP)
      continue
    }

    const inline = INLINE.exec(line)
    if (inline) {
      const [, code = "", expr = ""] = inline
      if (check(expr.trim(), lineNo)) out.push(activateDormant(code))
      else out.push(GAP)
      continue
    }

    out.push(activateDormant(line))
  }

  if (stack.length > 0) {
    const open = stack[stack.length - 1]!
    throw new MarkerError("klin:if is never closed", file, open.line)
  }

  return tidy(out, endsWithNewline)
}

function activateDormant(line: string): string {
  const jsx = DORMANT_JSX.exec(line)
  if (jsx) return `${jsx[1]}${jsx[2]}`
  const block = DORMANT_BLOCK.exec(line)
  if (block) return `${block[1]}${block[2]}`
  const dormant = DORMANT_LINE.exec(line)
  if (dormant) return `${dormant[1]}${dormant[2]}`
  return line
}

const isBlank = (s: string | undefined) => s !== undefined && s.trim() === ""

/**
 * Removing blocks tends to leave doubled blank lines or a blank line right after
 * `{` / before `}`. Clean those up — but only where something was removed, so
 * untouched regions of the file stay exactly as the template author wrote them.
 */
function tidy(lines: Array<string | typeof GAP>, endsWithNewline: boolean): string {
  const result: string[] = []
  let pendingGap = false

  for (const line of lines) {
    if (line === GAP) {
      pendingGap = true
      continue
    }
    if (pendingGap) {
      const prev = result[result.length - 1]
      if (isBlank(line)) {
        if (prev === undefined || isBlank(prev) || /[{[(]\s*$/.test(prev)) continue
      } else {
        if (isBlank(prev) && /^\s*(?:[}\])]|<\/)/.test(line)) result.pop()
        pendingGap = false
      }
    }
    result.push(line)
  }

  if (pendingGap) {
    while (result.length > 0 && isBlank(result[result.length - 1])) result.pop()
  }

  const body = result.join("\n")
  return endsWithNewline && body.length > 0 ? `${body}\n` : body
}

/** Lists every flag referenced by markers in `text` (for template linting). */
export function referencedFlags(text: string): string[] {
  if (!hasMarkers(text)) return []
  const found = new Set<string>()
  for (const line of text.split("\n")) {
    const directive = DIRECTIVE.exec(line)
    const expr = directive?.[2] ?? INLINE.exec(line)?.[2]
    if (expr && expr.trim()) {
      for (const id of identifiers(expr.trim())) found.add(id)
    }
  }
  return [...found]
}
