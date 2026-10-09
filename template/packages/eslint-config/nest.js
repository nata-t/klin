import { defineConfig } from "eslint/config"
import globals from "globals"
import { base } from "./base.js"

/** NestJS: Node globals, and no `import type` nagging — DI needs value imports. */
export const nest = defineConfig(base, {
  languageOptions: {
    globals: { ...globals.node },
  },
  rules: {
    "@typescript-eslint/consistent-type-imports": "off",
    "@typescript-eslint/no-extraneous-class": "off",
  },
})

export default nest
