/**
 * Tiny boolean expression language used by template markers.
 *
 *   google
 *   !sqlite
 *   google || github
 *   organizations && (email || queues)
 *
 * Identifiers are flag names (`[a-z0-9][a-z0-9-]*`). Unknown identifiers are an
 * error, so a typo in a template fails loudly instead of silently stripping code.
 */

type Token =
  | { kind: "ident"; value: string }
  | { kind: "op"; value: "!" | "&&" | "||" | "(" | ")" }

export class ExprError extends Error {
  constructor(message: string, readonly source: string) {
    super(`${message} in expression "${source}"`)
    this.name = "ExprError"
  }
}

function tokenize(source: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]!
    if (/\s/.test(ch)) {
      i++
      continue
    }
    const two = source.slice(i, i + 2)
    if (two === "&&" || two === "||") {
      tokens.push({ kind: "op", value: two })
      i += 2
      continue
    }
    if (ch === "!" || ch === "(" || ch === ")") {
      tokens.push({ kind: "op", value: ch })
      i++
      continue
    }
    const match = /^[a-z0-9][a-z0-9-]*/i.exec(source.slice(i))
    if (match) {
      tokens.push({ kind: "ident", value: match[0].toLowerCase() })
      i += match[0].length
      continue
    }
    throw new ExprError(`Unexpected character "${ch}"`, source)
  }
  return tokens
}

type Node =
  | { kind: "ident"; name: string }
  | { kind: "not"; operand: Node }
  | { kind: "and" | "or"; left: Node; right: Node }

function parse(source: string): Node {
  const tokens = tokenize(source)
  let pos = 0
  const peek = () => tokens[pos]
  const isOp = (value: string) => {
    const t = peek()
    return t?.kind === "op" && t.value === value
  }

  function parseOr(): Node {
    let left = parseAnd()
    while (isOp("||")) {
      pos++
      left = { kind: "or", left, right: parseAnd() }
    }
    return left
  }

  function parseAnd(): Node {
    let left = parseUnary()
    while (isOp("&&")) {
      pos++
      left = { kind: "and", left, right: parseUnary() }
    }
    return left
  }

  function parseUnary(): Node {
    const t = peek()
    if (!t) throw new ExprError("Unexpected end", source)
    if (t.kind === "op" && t.value === "!") {
      pos++
      return { kind: "not", operand: parseUnary() }
    }
    if (t.kind === "op" && t.value === "(") {
      pos++
      const inner = parseOr()
      if (!isOp(")")) throw new ExprError('Missing ")"', source)
      pos++
      return inner
    }
    if (t.kind === "ident") {
      pos++
      return { kind: "ident", name: t.value }
    }
    throw new ExprError(`Unexpected "${t.value}"`, source)
  }

  if (tokens.length === 0) throw new ExprError("Empty expression", source)
  const node = parseOr()
  if (pos < tokens.length) throw new ExprError("Trailing tokens", source)
  return node
}

const cache = new Map<string, Node>()

export interface FlagSet {
  /** Flags that are on. */
  readonly on: ReadonlySet<string>
  /** Every flag the template knows about (on or off). */
  readonly known: ReadonlySet<string>
}

export function evaluate(source: string, flags: FlagSet): boolean {
  let node = cache.get(source)
  if (!node) {
    node = parse(source)
    cache.set(source, node)
  }
  const walk = (n: Node): boolean => {
    switch (n.kind) {
      case "ident":
        if (!flags.known.has(n.name)) {
          throw new ExprError(`Unknown flag "${n.name}"`, source)
        }
        return flags.on.has(n.name)
      case "not":
        return !walk(n.operand)
      case "and":
        return walk(n.left) && walk(n.right)
      case "or":
        return walk(n.left) || walk(n.right)
    }
  }
  return walk(node)
}

/** Every identifier referenced by an expression (used by `klin template lint`). */
export function identifiers(source: string): string[] {
  const out: string[] = []
  for (const t of tokenize(source)) if (t.kind === "ident") out.push(t.value)
  return out
}
