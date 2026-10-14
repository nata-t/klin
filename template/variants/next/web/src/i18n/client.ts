// klin:file i18n
import i18next from "i18next"
import { initReactI18next } from "react-i18next"
import { LANGUAGE_COOKIE, type Language, resources } from "@/i18n"

/** An i18next instance for one render: one per request on the server, one per visit in the browser. */
export function createI18n(language: Language) {
  const i18n = i18next.createInstance()
  void i18n.use(initReactI18next).init({
    resources,
    lng: language,
    fallbackLng: "en",
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  i18n.on("languageChanged", (lng) => {
    document.documentElement.lang = lng
    document.cookie = `${LANGUAGE_COOKIE}=${lng}; path=/; max-age=31536000; samesite=lax`
  })
  return i18n
}
