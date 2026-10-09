import { randomBytes } from "node:crypto"

export type SecretKind = "secret" | "password"

const generate = (kind: SecretKind) =>
  kind === "secret" ? randomBytes(32).toString("base64url") : randomBytes(16).toString("hex")

const LINE = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/

function unquote(value: string) {
  return value.replace(/^(['"])(.*)\1$/, "$2")
}

/** KEY=VALUE pairs from a dotenv file (comments and blanks skipped). */
export function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const match = LINE.exec(line)
    if (match) out.set(match[1]!, unquote(match[2]!.trim()))
  }
  return out
}

/**
 * Builds a real `.env` from `.env.example`: every key listed in `secrets` gets
 * a fresh random value, and every other place its example value appears
 * (e.g. the password inside DATABASE_URL) is updated to match.
 */
export function generateEnv(example: string, secrets: Record<string, SecretKind>) {
  const values = parseEnv(example)
  const replacements = new Map<string, string>()
  for (const [key, kind] of Object.entries(secrets)) {
    const exampleValue = values.get(key)
    if (!exampleValue || replacements.has(exampleValue)) continue
    replacements.set(exampleValue, generate(kind))
  }

  return example
    .split("\n")
    .map((line) => {
      const match = LINE.exec(line)
      if (!match) return line
      let value = match[2]!
      for (const [from, to] of replacements) value = value.split(from).join(to)
      return line.slice(0, line.length - match[2]!.length) + value
    })
    .join("\n")
}

/**
 * Appends keys that exist in the new `.env.example` but not in `.env`
 * (used when a module is added later). Returns the keys that were added.
 */
export function mergeEnv(current: string, example: string, secrets: Record<string, SecretKind>) {
  const have = parseEnv(current)
  const fresh = parseEnv(generateEnv(example, secrets))
  const added: string[] = []
  const lines: string[] = []
  for (const [key, value] of fresh) {
    if (have.has(key)) continue
    added.push(key)
    lines.push(`${key}=${/\s/.test(value) ? JSON.stringify(value) : value}`)
  }
  if (lines.length === 0) return { text: current, added }
  const text = `${current.replace(/\n*$/, "\n")}\n# Added by klin\n${lines.join("\n")}\n`
  return { text, added }
}
