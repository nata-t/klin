import { execFileSync } from "node:child_process"
import type { PackageManager } from "../engine/manifest"

/** Which package manager launched us (`npm create`, `pnpm create`, `bun create`, …). */
export function detectInvokingPm(): PackageManager | undefined {
  const ua = process.env.npm_config_user_agent ?? ""
  if (ua.startsWith("pnpm")) return "pnpm"
  if (ua.startsWith("bun")) return "bun"
  if (ua.startsWith("npm")) return "npm"
  if (process.versions.bun) return "bun"
  return undefined
}

const versionCache = new Map<PackageManager, string | null>()

export function pmVersion(pm: PackageManager): string | null {
  if (versionCache.has(pm)) return versionCache.get(pm)!
  let version: string | null = null
  try {
    version = execFileSync(pm, ["--version"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 10_000,
      cwd: process.env.HOME ?? process.cwd(),
    }).trim()
    if (!/^\d+\.\d+\.\d+/.test(version)) version = null
  } catch {
    version = null
  }
  versionCache.set(pm, version)
  return version
}

/** Fallback versions written to `packageManager` when the binary isn't installed. */
export const FALLBACK_PM_VERSIONS: Record<PackageManager, string> = {
  pnpm: "11.20.0",
  bun: "1.3.14",
  npm: "11.17.0",
}

export interface PmCommands {
  install: string
  run: (script: string) => string
  exec: (bin: string) => string
  dlx: (pkg: string) => string
}

export function pmCommands(pm: PackageManager): PmCommands {
  switch (pm) {
    case "pnpm":
      return {
        install: "pnpm install",
        run: (s) => `pnpm ${s}`,
        exec: (b) => `pnpm exec ${b}`,
        dlx: (p) => `pnpm dlx ${p}`,
      }
    case "bun":
      return {
        install: "bun install",
        run: (s) => `bun run ${s}`,
        exec: (b) => `bunx ${b}`,
        dlx: (p) => `bunx ${p}`,
      }
    case "npm":
      return {
        install: "npm install",
        run: (s) => `npm run ${s}`,
        exec: (b) => `npx --no -- ${b}`,
        dlx: (p) => `npx ${p}`,
      }
  }
}

/**
 * The template is written with pnpm commands. This rewrites a single shell
 * command string (a package.json script, a husky hook, a code block line) for
 * the chosen package manager.
 *
 *   pnpm --dir packages/db run db:migrate   → npm --prefix packages/db run db:migrate
 *   pnpm exec lint-staged                   → bunx lint-staged
 *   pnpm dev                                → npm run dev
 */
export function rewriteCommand(command: string, pm: PackageManager): string {
  if (pm === "pnpm" || !command.includes("pnpm")) return command
  return command.replace(
    /(?<![\w@/.-])pnpm(?![\w./-])((?:[ \t]+(?!&&|\|\||;|\|)[^\s;&|]+)*)/g,
    (_match, rest: string) => rewriteInvocation(rest.trim().split(/\s+/).filter(Boolean), pm)
  )
}

/** `pnpm <bin>` runs a binary, not a script — these become `bunx` / `npx`. */
const BINARIES = new Set(["turbo", "prisma", "playwright", "vitest", "tsc", "tsx", "tsr", "eslint", "prettier", "shadcn", "email"])

function rewriteInvocation(args: string[], pm: Exclude<PackageManager, "pnpm">): string {
  const [first, ...rest] = args
  const tail = rest.join(" ")
  const join = (...parts: string[]) => parts.filter(Boolean).join(" ")

  if (first === undefined) return pm
  if (first === "install" || first === "i") return join(pm, "install", tail)
  if (first === "add") {
    const dev = rest.includes("-D") || rest.includes("--save-dev")
    const pkgs = rest.filter((a) => a !== "-D" && a !== "--save-dev").join(" ")
    if (pm === "bun") return join("bun add", dev ? "-d" : "", pkgs)
    return join("npm install", dev ? "-D" : "", pkgs)
  }
  if (first === "remove" || first === "rm") return join(pm === "bun" ? "bun remove" : "npm uninstall", tail)
  if (first === "dlx") return join(pm === "bun" ? "bunx" : "npx", tail)
  if (first === "exec") return join(pm === "bun" ? "bunx" : "npx --no --", tail)
  if (BINARIES.has(first)) return join(pm === "bun" ? "bunx" : "npx --no --", first, tail)
  if (first === "create") return join(pm === "bun" ? "bun create" : "npm create", tail)
  if (first === "--dir" || first === "-C") {
    const [dir, maybeRun, ...more] = rest
    if (maybeRun === "exec") {
      return `cd ${dir ?? "."} && ${pm === "bun" ? "bunx" : "npx --no --"} ${more.join(" ")}`.trim()
    }
    const script = maybeRun === "run" ? more : [maybeRun ?? "", ...more]
    if (pm === "bun") return join("bun run --cwd", dir ?? ".", script.join(" "))
    return join("npm --prefix", dir ?? ".", "run", script.join(" "))
  }
  if (first === "--filter" || first === "-F") {
    const [pkg, maybeRun, ...more] = rest
    const script = maybeRun === "run" ? more : [maybeRun ?? "", ...more]
    if (pm === "bun") return join("bun run --filter", pkg ?? "", script.join(" "))
    return join("npm run", script[0] ?? "", "--workspace", pkg ?? "", script.slice(1).length ? "-- " + script.slice(1).join(" ") : "")
  }
  if (first === "run") {
    const [script, ...more] = rest
    return runScript(pm, script ?? "", more)
  }
  return runScript(pm, first, rest)
}

function runScript(pm: Exclude<PackageManager, "pnpm">, script: string, args: string[]) {
  if (args.length === 0) return `${pm} run ${script}`
  // npm needs `--` before arguments that look like flags.
  if (pm === "npm" && args.some((a) => a.startsWith("-"))) return `npm run ${script} -- ${args.join(" ")}`
  return `${pm} run ${script} ${args.join(" ")}`
}

/** Rewrites pnpm commands inside fenced code blocks and inline code in Markdown. */
export function rewriteMarkdown(markdown: string, pm: PackageManager): string {
  if (pm === "pnpm" || !markdown.includes("pnpm")) return markdown
  let inFence = false
  return markdown
    .split("\n")
    .map((line) => {
      if (/^\s*(```|~~~)/.test(line)) {
        inFence = !inFence
        return line
      }
      if (inFence) return rewriteCommand(line, pm)
      return line.replace(/`([^`]*\bpnpm\b[^`]*)`/g, (_m, code: string) => `\`${rewriteCommand(code, pm)}\``)
    })
    .join("\n")
}

export function lockfileFor(pm: PackageManager): string {
  return { pnpm: "pnpm-lock.yaml", bun: "bun.lock", npm: "package-lock.json" }[pm]
}
