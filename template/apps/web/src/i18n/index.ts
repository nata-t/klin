import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import en from "./locales/en.json"

/**
 * Translations live in ./locales/<lang>.json, starting with English.
 *
 * Add a language:
 *   1. copy locales/en.json to locales/<code>.json and translate the values
 *   2. import it below and add it to `resources` and LANGUAGES
 *
 * The language switcher in the headers shows up as soon as LANGUAGES has more
 * than one entry. Keys missing from a language fall back to English.
 */
export const LANGUAGES = [{ code: "en", label: "English" }] as const

const resources = {
  en: { translation: en },
}

const STORAGE_KEY = "language"

function initialLanguage() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved && LANGUAGES.some((l) => l.code === saved)) return saved
  } catch {
    // ignore
  }
  const browser = navigator.language.split("-")[0]
  return LANGUAGES.some((l) => l.code === browser) ? browser! : "en"
}

void i18n.use(initReactI18next).init({
  resources,
  lng: initialLanguage(),
  fallbackLng: "en",
  interpolation: { escapeValue: false },
})

i18n.on("languageChanged", (lng) => {
  document.documentElement.lang = lng
  try {
    localStorage.setItem(STORAGE_KEY, lng)
  } catch {
    // ignore
  }
})

export default i18n
