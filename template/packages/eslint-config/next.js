import nextPlugin from "@next/eslint-plugin-next"
import { defineConfig, globalIgnores } from "eslint/config"
import { react } from "./react.js"

/** Next.js: the React rules plus Next's own (Core Web Vitals included). */
export const next = defineConfig(react, globalIgnores(["**/.next/**", "**/next-env.d.ts"]), {
  files: ["**/*.{ts,tsx}"],
  plugins: { "@next/next": nextPlugin },
  rules: {
    ...nextPlugin.configs.recommended.rules,
    ...nextPlugin.configs["core-web-vitals"].rules,
  },
})

export default next
