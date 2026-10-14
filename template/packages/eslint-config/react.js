import { defineConfig } from "eslint/config"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh" // klin:only vite
import globals from "globals"
import { base } from "./base.js"

/** React + Vite: hooks rules, fast-refresh safety, browser globals. */ // klin:only vite
//? /** React: hooks rules and browser globals. */ // klin:only next
export const react = defineConfig(base, {
  files: ["**/*.{ts,tsx}"],
  extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite], // klin:only vite
  //? extends: [reactHooks.configs.flat.recommended], // klin:only next
  languageOptions: {
    globals: { ...globals.browser },
  },
  // klin:if vite
  rules: {
    // Route files export `Route` alongside components — that's fine.
    "react-refresh/only-export-components": "off",
    // Vite's built-in import.meta.env flags aren't env vars Turborepo needs to know about.
    "turbo/no-undeclared-env-vars": ["error", { allowList: ["^DEV$", "^PROD$", "^MODE$", "^SSR$", "^BASE_URL$"] }],
  },
  // klin:endif
})

export default react
