// klin:if i18n
import { useTranslation } from "react-i18next"

/**
 * `t(key, fallback, values?)` — translated text for `key`, or the English
 * fallback while a language doesn't have it yet. `{{name}}` placeholders are
 * filled from `values`. Translations: src/i18n/locales/*.json
 */
export function useT() {
  const { t } = useTranslation()
  return (key: string, fallback: string, values?: Record<string, string | number>) =>
    t(key, { defaultValue: fallback, ...values })
}
// klin:else
//? /**
//?  * `t(key, fallback, values?)` — returns the English text today. The keys make
//?  * the UI ready for translation: `klin add i18n` wires them up to i18next.
//?  */
//? export function useT() {
//?   return (_key: string, fallback: string, values?: Record<string, string | number>) =>
//?     fallback.replace(/\{\{(\w+)\}\}/g, (match, name: string) => String(values?.[name] ?? match))
//? }
// klin:endif
