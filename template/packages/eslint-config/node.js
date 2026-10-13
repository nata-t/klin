import { defineConfig } from "eslint/config"
import globals from "globals"
import { base } from "./base.js"

/** Plain Node.js servers (Express / Fastify): Node globals on top of the base rules. */
export const node = defineConfig(base, {
  languageOptions: {
    globals: { ...globals.node },
  },
})

export default node
