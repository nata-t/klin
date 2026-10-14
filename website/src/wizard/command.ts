import { type Answers, type Manifest, normalizeAnswers, type PackageManager } from "@cli/engine/manifest"

export interface Picks {
  name: string
  pm: PackageManager
  preset: string
  answers: Answers
}

const same = (a: string | string[] | undefined, b: string | string[] | undefined) =>
  JSON.stringify(Array.isArray(a) ? [...a].sort() : a) === JSON.stringify(Array.isArray(b) ? [...b].sort() : b)

/**
 * The shortest command that recreates these picks: the preset, plus a flag
 * for every question whose answer differs from it (create-klin lets flags
 * override the preset question by question). `bun create` and `pnpm create`
 * take flags directly; `npm create` needs them after `--`.
 */
export function commandFor(manifest: Manifest, picks: Picks): string {
  const presetAnswers = manifest.presets?.[picks.preset]?.answers ?? {}
  const base = normalizeAnswers(manifest, presetAnswers).answers
  const flags: string[] = []
  if (picks.preset !== "recommended") flags.push(`--preset ${picks.preset}`)
  for (const question of manifest.questions) {
    const value = picks.answers[question.id]
    if (same(value, base[question.id])) continue
    const flag = `--${question.flag ?? question.id}`
    if (Array.isArray(value)) flags.push(`${flag} ${value.length ? value.join(",") : "none"}`)
    else if (value !== undefined) flags.push(`${flag} ${value}`)
  }
  flags.push("-y")
  const head = picks.pm === "npm" ? `npm create klin@latest ${picks.name}` : `${picks.pm} create klin ${picks.name}`
  return picks.pm === "npm" ? `${head} -- ${flags.join(" ")}` : `${head} ${flags.join(" ")}`
}
