import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { MANIFEST_FILE } from "./engine/manifest"

declare const __KLIN_VERSION__: string | undefined

/** The create-klin package root (works from dist/ and from src/ in dev). */
export const packageRoot = (() => {
  let dir = dirname(fileURLToPath(import.meta.url))
  while (dir !== dirname(dir)) {
    const pkg = join(dir, "package.json")
    if (existsSync(pkg) && JSON.parse(readFileSync(pkg, "utf8")).name === "create-klin") return dir
    dir = dirname(dir)
  }
  throw new Error("Couldn't locate the create-klin package")
})()

export const VERSION: string =
  typeof __KLIN_VERSION__ === "string"
    ? __KLIN_VERSION__
    : JSON.parse(readFileSync(join(packageRoot, "package.json"), "utf8")).version

/** True when running from a klin repo checkout instead of an installed package. */
export const isDevCheckout = existsSync(join(packageRoot, "../../template", MANIFEST_FILE))

export function bundledTemplateDir() {
  const published = join(packageRoot, "template")
  if (existsSync(join(published, MANIFEST_FILE))) return published
  const dev = join(packageRoot, "../../template")
  if (existsSync(join(dev, MANIFEST_FILE))) return dev
  throw new Error("The bundled template is missing — reinstall create-klin")
}

/**
 * The devDependency added to generated projects so `pnpm klin …` works offline
 * and always uses the version the project was made with.
 *
 * KLIN_CLI_DEPENDENCY overrides it, e.g. `file:/path/to/create-klin-0.1.0.tgz`
 * when testing a packed tarball that isn't on npm yet.
 */
export function cliDependency() {
  if (process.env.KLIN_CLI_DEPENDENCY) return process.env.KLIN_CLI_DEPENDENCY
  return isDevCheckout ? `file:${packageRoot}` : `^${VERSION}`
}

export interface TemplateSource {
  dir: string
  /** What gets recorded in klin.json. */
  source: string
}

/**
 * Resolves `--template`:
 *   (none)                       → the template bundled with create-klin
 *   ./my-template, /abs/path     → a local folder
 *   github:owner/repo[/sub][#ref] → shallow-cloned from GitHub
 */
export function resolveTemplate(spec?: string, cwd = process.cwd()): TemplateSource {
  if (!spec || spec === "bundled") return { dir: bundledTemplateDir(), source: "bundled" }

  const gh = /^(?:github:|gh:|https:\/\/github\.com\/)([\w.-]+)\/([\w.-]+?)(?:\.git)?(\/[^#]*)?(?:#(.+))?$/.exec(spec)
  if (gh) {
    const [, owner, repo, sub = "", ref] = gh
    const target = mkdtempSync(join(tmpdir(), "klin-template-"))
    const args = ["clone", "--depth", "1", ...(ref ? ["--branch", ref] : []), `https://github.com/${owner}/${repo}.git`, target]
    try {
      execFileSync("git", args, { stdio: "ignore" })
    } catch {
      throw new Error(`Couldn't clone ${owner}/${repo}${ref ? `#${ref}` : ""} — does it exist and is it public?`)
    }
    const dir = join(target, sub)
    if (!existsSync(join(dir, MANIFEST_FILE))) {
      throw new Error(`${spec} doesn't contain a ${MANIFEST_FILE}`)
    }
    return { dir, source: spec }
  }

  const dir = resolve(cwd, spec)
  if (!existsSync(join(dir, MANIFEST_FILE))) {
    throw new Error(`No ${MANIFEST_FILE} found in ${dir}`)
  }
  return { dir, source: dir }
}
