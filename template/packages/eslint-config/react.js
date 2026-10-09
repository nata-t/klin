import { defineConfig } from "eslint/config"
import reactHooks from "eslint-plugin-react-hooks"
import reactRefresh from "eslint-plugin-react-refresh"
import globals from "globals"
import { base } from "./base.js"

/** React + Vite: hooks rules, fast-refresh safety, browser globals. */
export const react = defineConfig(base, {
  files: ["**/*.{ts,tsx}"],
  extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  languageOptions: {
    globals: { ...globals.browser },
  },
  rules: {
    // Route files export `Route` alongside components — that's fine.
    "react-refresh/only-export-components": "off",
    // Vite's built-in import.meta.env flags aren't env vars Turborepo needs to know about.
    "turbo/no-undeclared-env-vars": ["error", { allowList: ["^DEV$", "^PROD$", "^MODE$", "^SSR$", "^BASE_URL$"] }],
  },
})

export default react
