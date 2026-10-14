// klin:file i18n
import en from "./locales/en.json"

/**
 * Translations live in ./locales/<lang>.json, starting with English.
 *
 * Add a language:
 *   1. copy locales/en.json to locales/<code>.json and translate the values
 *   2. import it below and add it to `resources` and LANGUAGES
 *
 * The language switcher in the headers shows up as soon as LANGUAGES has more
 * than one entry. Keys missing from a language fall back to English. The
 * choice is kept in a cookie, so the server renders pages in it too.
 */
export const LANGUAGES = [{ code: "en", label: "English" }] as const

export type Language = (typeof LANGUAGES)[number]["code"]

export const resources = {
  en: { translation: en },
}

export const LANGUAGE_COOKIE = "language"

export function isLanguage(code: string | undefined): code is Language {
  return LANGUAGES.some((language) => language.code === code)
}
