import js from "@eslint/js"
import prettier from "eslint-config-prettier/flat"
import turbo from "eslint-plugin-turbo"
import { defineConfig, globalIgnores } from "eslint/config"
import tseslint from "typescript-eslint"

/** Shared rules for every package. Formatting is Prettier's job, not ESLint's. */
export const base = defineConfig(
  globalIgnores([
    "**/dist/**",
    "**/coverage/**",
    "**/.turbo/**",
    "**/src/generated/**",
    "**/routeTree.gen.ts",
  ]),
  js.configs.recommended,
  tseslint.configs.recommended,
  turbo.configs["flat/recommended"],
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "warn",
        { fixStyle: "inline-type-imports", disallowTypeAnnotations: false },
      ],
    },
  },
  prettier
)

export default base
