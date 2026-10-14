import type { Manifest } from "@cli/engine/manifest"
import raw from "../../../template/klin.template.json"

/**
 * The template's manifest, read at build time: every option, preset and
 * question on the site comes from here, so the site can't drift from what
 * create-klin actually offers.
 */
export const manifest = raw as unknown as Manifest

export type Option = Manifest["options"][string] & { id: string }

export const option = (id: string): Option => ({ id, ...manifest.options[id]! })

export const question = (id: string) => {
  const q = manifest.questions.find((q) => q.id === id)
  if (!q) throw new Error(`No question "${id}" in klin.template.json`)
  return q
}

export const optionsOf = (questionId: string): Option[] => question(questionId).options.map(option)

/** The answer a question starts with when no preset or flag says otherwise. */
export const defaultOf = (questionId: string) => question(questionId).default

export const presets = Object.entries(manifest.presets ?? {}).map(([id, preset]) => ({ id, ...preset }))
