/** Splits "myCoolThing", "my-cool_thing", "My Cool Thing" into ["my","cool","thing"]. */
export function words(input: string): string[] {
  return input
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .split(/[^a-zA-Z0-9]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase())
}

const cap = (w: string) => (w ? w[0]!.toUpperCase() + w.slice(1) : w)

export const kebab = (s: string) => words(s).join("-")
export const snake = (s: string) => words(s).join("_")
export const pascal = (s: string) => words(s).map(cap).join("")
export const camel = (s: string) => {
  const p = pascal(s)
  return p ? p[0]!.toLowerCase() + p.slice(1) : p
}
export const title = (s: string) => words(s).map(cap).join(" ")

const IRREGULAR: Record<string, string> = {
  person: "people",
  child: "children",
  man: "men",
  woman: "women",
  mouse: "mice",
  goose: "geese",
  tooth: "teeth",
  foot: "feet",
  datum: "data",
  index: "indices",
  status: "statuses",
}
const UNCOUNTABLE = new Set(["data", "information", "equipment", "news", "series", "species", "media", "feedback", "metadata", "settings"])
const SINGULAR: Record<string, string> = Object.fromEntries(Object.entries(IRREGULAR).map(([one, many]) => [many, one]))
/** Words ending in "ies" whose singular ends in "ie", not "y". */
const IE_WORDS = new Set(["movie", "cookie", "pie", "tie", "lie", "zombie", "rookie", "selfie", "calorie", "smoothie", "brownie", "newbie", "goodie"])

/** Good-enough English pluralization for generated names. */
export function pluralize(word: string): string {
  const lower = word.toLowerCase()
  if (UNCOUNTABLE.has(lower)) return word
  if (IRREGULAR[lower]) return matchCase(word, IRREGULAR[lower]!)
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + "ies"
  if (/(s|x|z|ch|sh)$/i.test(word)) return word + "es"
  if (/[^f]fe$/i.test(word)) return word.slice(0, -2) + "ves"
  if (/[^f]f$/i.test(word) && !/(roof|chief|belief|proof)$/i.test(word)) return word.slice(0, -1) + "ves"
  return word + "s"
}

function matchCase(source: string, target: string) {
  return source[0] === source[0]?.toUpperCase() ? cap(target) : target
}

/** The reverse of `pluralize`: "payments" → "payment", "categories" → "category". */
export function singularize(word: string): string {
  const lower = word.toLowerCase()
  if (UNCOUNTABLE.has(lower) || IRREGULAR[lower]) return word
  if (SINGULAR[lower]) return matchCase(word, SINGULAR[lower]!)
  if (/[^aeiou]ies$/i.test(word) && !IE_WORDS.has(lower.slice(0, -1))) return word.slice(0, -3) + "y"
  if (/(ss|x|z|ch|sh)es$/i.test(word)) return word.slice(0, -2)
  if (/(ss|us|is)$/i.test(word) || !/s$/i.test(word)) return word
  return word.slice(0, -1)
}

/** Pluralizes the last word of a multi-word name: "blog post" → "blog posts". */
export function pluralizeName(name: string): string {
  return mapLastWord(name, pluralize)
}

/** Singularizes the last word of a multi-word name: "blog posts" → "blog post". */
export function singularizeName(name: string): string {
  return mapLastWord(name, singularize)
}

function mapLastWord(name: string, fn: (word: string) => string) {
  const parts = words(name)
  if (parts.length === 0) return name
  parts[parts.length - 1] = fn(parts[parts.length - 1]!)
  return parts.join("-")
}

/** npm package-name friendly slug. */
export function toSlug(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-~._]+/g, "-")
    .replace(/^[-._]+|[-._]+$/g, "")
}

export function isValidPackageName(name: string): boolean {
  return /^(?:@[a-z0-9-*~][a-z0-9-*._~]*\/)?[a-z0-9-~][a-z0-9-._~]*$/.test(name) && name.length <= 214
}
