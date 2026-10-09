import { readFileSync } from "node:fs"
import { defineConfig } from "tsup"

const { version } = JSON.parse(readFileSync("./package.json", "utf8")) as { version: string }

export default defineConfig({
  entry: ["src/index.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  clean: true,
  // Ship one self-contained file so `npm create klin` starts instantly.
  noExternal: [/.*/],
  splitting: false,
  shims: false,
  banner: { js: 'import { createRequire as __klinRequire } from "node:module"; const require = __klinRequire(import.meta.url);' },
  define: { __KLIN_VERSION__: JSON.stringify(version) },
})
