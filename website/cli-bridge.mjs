import { readFileSync } from "node:fs"
import { dirname, resolve, sep } from "node:path"
import { fileURLToPath } from "node:url"

/**
 * Lets the landing page run the CLI's own wizard in the browser.
 *
 * The wizard, its form renderer and the logo live in
 * packages/create-klin/src and expect a terminal: Node's fs, path and
 * readline, `process.env` for color detection, and a full-screen `screen`.
 * For modules inside that folder only, this plugin swaps those for the small
 * browser stand-ins in src/wizard/shims/ — so what visitors click through is
 * the real wizard, not a copy that could drift from it.
 */

const here = dirname(fileURLToPath(import.meta.url))
export const cliSrc = resolve(here, "../packages/create-klin/src")
const shims = resolve(here, "src/wizard/shims")
const templateDir = resolve(here, "../template")

const builtins = {
  "node:fs": `${shims}/node-fs.ts`,
  "node:path": `${shims}/node-path.ts`,
  "node:readline": `${shims}/node-empty.ts`,
  "node:child_process": `${shims}/node-empty.ts`,
  "node:os": `${shims}/node-empty.ts`,
  "node:url": `${shims}/node-empty.ts`,
}

/** CLI modules that only make sense in a terminal, and their browser versions. */
const modules = {
  [resolve(cliSrc, "context.ts")]: `${shims}/context.ts`,
  [resolve(cliSrc, "ui/term.ts")]: `${shims}/term.ts`,
  [resolve(cliSrc, "utils/fs.ts")]: `${shims}/utils-fs.ts`,
}

const inCli = (id) => id.startsWith(cliSrc + sep)
const clean = (id) => id.split("?")[0]

export function cliBridge() {
  return {
    name: "klin-cli-bridge",
    enforce: "pre",
    async resolveId(source, importer, options) {
      // `klin-template:<path>` imports a template file's text, untouched by any transform.
      if (source.startsWith("klin-template:")) return `\0klin-template:${encodeURIComponent(source.slice(14)).replace(/\./g, "%2E")}`
      if (!importer || !inCli(clean(importer))) return null
      if (builtins[source]) return builtins[source]
      if (!source.startsWith(".")) return null
      const resolved = await this.resolve(source, importer, { ...options, skipSelf: true })
      const target = resolved && modules[clean(resolved.id)]
      return target ?? null
    },
    load(id) {
      if (!id.startsWith("\0klin-template:")) return null
      const path = resolve(templateDir, decodeURIComponent(id.slice("\0klin-template:".length)))
      if (!path.startsWith(templateDir + sep)) throw new Error(`klin-template: ${path} is outside the template`)
      this.addWatchFile(path)
      return `export default ${JSON.stringify(readFileSync(path, "utf8"))}`
    },
    transform(code, id) {
      if (!inCli(clean(id))) return null
      // `process` (env, platform, stdout size) becomes a module-local stand-in.
      return { code: `import { process } from ${JSON.stringify(`${shims}/process.ts`)};\n${code}`, map: null }
    },
  }
}
