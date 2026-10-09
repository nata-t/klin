import i18n from "i18next"
import { initReactI18next } from "react-i18next"
import am from "./locales/am.json"
import en from "./locales/en.json"

/**
 * Translations live in ./locales/<lang>.json. Add a language: create the file,
 * add it to `resources` and to LANGUAGES. Missing keys fall back to English.
 */
export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "am", label: "አማርኛ" },
] as const

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
  resources: { en: { translation: en }, am: { translation: am } },
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
