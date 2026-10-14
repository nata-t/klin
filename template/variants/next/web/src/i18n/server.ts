// klin:file i18n
import "server-only"
import { cookies, headers } from "next/headers"
import { isLanguage, LANGUAGE_COOKIE, type Language } from "@/i18n"

/** The visitor's language: the one they picked, else their browser's, else English. */
export async function getLanguage(): Promise<Language> {
  const picked = (await cookies()).get(LANGUAGE_COOKIE)?.value
  if (isLanguage(picked)) return picked
  for (const part of ((await headers()).get("accept-language") ?? "").split(",")) {
    const code = part.split(";")[0]?.trim().split("-")[0]
    if (isLanguage(code)) return code
  }
  return "en"
}
