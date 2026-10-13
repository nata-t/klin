import { existsSync, readdirSync, readFileSync } from "node:fs"
import { connect, createServer } from "node:net"
import { join } from "node:path"
import { glob } from "tinyglobby"
import { resolveTemplate, VERSION } from "../context"
import { loadManifest } from "../engine/manifest"
import { intro, outro } from "../ui/log"
import { spinner } from "../ui/task"
import { c, shimmer, sym } from "../ui/theme"
import { dockerFix, dockerState } from "../utils/docker"
import { parseEnv } from "../utils/env-file"
import { pmCommands, pmVersion } from "../utils/pm"
import { findProjectRoot, parsePackageManager, readProject } from "../utils/project"
import { bail, type Flags } from "./flags"

type Status = "ok" | "warn" | "fail" | "info"

interface Check {
  group: string
  title: string
  status: Status
  detail?: string
  hint?: string
}

const ICON: Record<Status, string> = {
  ok: c.ok(sym.check),
  warn: c.warn(sym.warn),
  fail: c.error(sym.cross),
  info: c.info(sym.info),
}

/**
 * `klin doctor` — is everything in place? Checks the toolchain, .env, the
 * services the app talks to, generated code, and dependency versions that
 * drifted apart across the workspace.
 */
export async function doctorCommand(_flags: Flags) {
  const root = findProjectRoot()
  if (!root) bail("Run this inside a klin project (no klin.json found).")
  const config = readProject(root)
  const enabled = new Set(Object.values(config.answers).flat())
  const { pm, version: pinnedPmVersion } = parsePackageManager(config.packageManager)
  const run = pmCommands(pm).run
  const checks: Check[] = []
  const add = (check: Check) => checks.push(check)

  intro("klin doctor", c.dim(`checking ${config.name}`))
  const spin = spinner("Listening to the heartbeat")

  /* ─── Toolchain ────────────────────────────────────────────────────── */
  const [major = 0, minor = 0] = process.versions.node.split(".").map(Number)
  const nodeOk = major > 22 || (major === 22 && minor >= 12)
  add({
    group: "Toolchain",
    title: `Node.js ${process.versions.node}`,
    status: nodeOk ? "ok" : "fail",
    hint: nodeOk ? undefined : "Install Node.js 22.12+ (24 LTS recommended) — see .nvmrc",
  })

  const installedPm = pmVersion(pm)
  if (!installedPm) {
    add({ group: "Toolchain", title: `${pm} isn't installed`, status: "fail", hint: `This project uses ${pm}@${pinnedPmVersion}` })
  } else {
    const sameMajor = installedPm.split(".")[0] === pinnedPmVersion.split(".")[0]
    add({
      group: "Toolchain",
      title: `${pm} ${installedPm}`,
      status: sameMajor ? "ok" : "warn",
      detail: sameMajor ? undefined : `package.json pins ${pm}@${pinnedPmVersion}`,
      hint: sameMajor ? undefined : `Corepack can match it: corepack enable && corepack use ${pm}@${pinnedPmVersion}`,
    })
  }

  add({
    group: "Toolchain",
    title: "Dependencies installed",
    status: existsSync(join(root, "node_modules")) ? "ok" : "fail",
    hint: existsSync(join(root, "node_modules")) ? undefined : pmCommands(pm).install,
  })

  add({
    group: "Toolchain",
    title: `klin ${VERSION}`,
    status: config.version === VERSION ? "ok" : "info",
    detail: config.version === VERSION ? undefined : `project was made with v${config.version}`,
    hint: config.version === VERSION ? undefined : `${run("klin upgrade")} merges template improvements (experimental)`,
  })

  /* ─── Configuration ────────────────────────────────────────────────── */
  const envPath = join(root, ".env")
  const examplePath = join(root, ".env.example")
  const env = existsSync(envPath) ? parseEnv(readFileSync(envPath, "utf8")) : null
  const example = existsSync(examplePath) ? parseEnv(readFileSync(examplePath, "utf8")) : new Map<string, string>()

  if (!env) {
    add({ group: "Configuration", title: ".env is missing", status: "fail", hint: "cp .env.example .env — then set BETTER_AUTH_SECRET" })
  } else {
    const missing = [...example.keys()].filter((key) => !env.has(key))
    add({
      group: "Configuration",
      title: missing.length ? `.env is missing ${missing.length} key(s)` : ".env has every key from .env.example",
      status: missing.length ? "warn" : "ok",
      detail: missing.length ? missing.join(", ") : undefined,
      hint: missing.length ? "Copy them over from .env.example" : undefined,
    })

    const secret = env.get("BETTER_AUTH_SECRET") ?? ""
    const weak = secret.length < 32 || secret === example.get("BETTER_AUTH_SECRET")
    add({
      group: "Configuration",
      title: weak ? "BETTER_AUTH_SECRET is weak or a placeholder" : "BETTER_AUTH_SECRET looks strong",
      status: weak ? "fail" : "ok",
      hint: weak ? "openssl rand -base64 32" : undefined,
    })

    for (const required of ["DATABASE_URL", "BETTER_AUTH_URL", "WEB_URL"]) {
      if (!env.get(required)) add({ group: "Configuration", title: `${required} is empty`, status: "fail" })
    }

    const providers = [
      ["google", "GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "Google"],
      ["github", "GITHUB_CLIENT_ID", "GITHUB_CLIENT_SECRET", "GitHub"],
    ] as const
    for (const [id, idKey, secretKey, label] of providers) {
      if (!enabled.has(id)) continue
      const configured = Boolean(env.get(idKey) && env.get(secretKey))
      add({
        group: "Configuration",
        title: configured ? `${label} sign-in is configured` : `${label} sign-in is off until it has credentials`,
        status: configured ? "ok" : "warn",
        hint: configured ? undefined : `Set ${idKey} and ${secretKey} in .env`,
      })
    }

    if (enabled.has("email")) {
      const key = env.get("RESEND_API_KEY")
      add({
        group: "Configuration",
        title: key ? "Resend is configured" : "Emails print to the API console (no RESEND_API_KEY)",
        status: key ? "ok" : "info",
        hint: key ? undefined : "Fine for development — add a key before production",
      })
    }
  }

  /* ─── Services ─────────────────────────────────────────────────────── */
  // Local services run in Docker Compose unless it's SQLite with nothing else to start.
  const compose = enabled.has("docker") && (config.answers.database !== "sqlite" || enabled.has("queues") || enabled.has("uploads"))
  if (compose) {
    const state = await dockerState()
    if (state === "ready") add({ group: "Services", title: "Docker is running", status: "ok" })
    else {
      const fix = dockerFix(state)
      const commands = fix.steps.filter(([command]) => !command.startsWith("#")).map(([command]) => command)
      add({
        group: "Services",
        title: fix.problem,
        status: "fail",
        detail: fix.steps.map(([command, why]) => (command.startsWith("#") ? `${command.slice(2)} — ${why}` : why)).join(" · "),
        hint: commands.length ? commands.join(" && ") : undefined,
      })
    }
  }
  const databaseUrl = env?.get("DATABASE_URL")
  if (databaseUrl) {
    if (databaseUrl.startsWith("file:")) {
      const file = databaseUrl.slice(5)
      const abs = file.startsWith("/") ? file : join(root, file)
      add({
        group: "Services",
        title: existsSync(abs) ? `SQLite database ${c.dim(file)}` : "SQLite database file doesn't exist yet",
        status: existsSync(abs) ? "ok" : "warn",
        hint: existsSync(abs) ? undefined : run("db:migrate"),
      })
    } else {
      add(await reach("Services", "Database", databaseUrl, enabled.has("docker") ? run("db:up") : "Start your database server"))
    }
  }
  if (enabled.has("queues") && env) {
    add(await reach("Services", "Redis", env.get("REDIS_URL") || "redis://localhost:6379", run("db:up")))
  }
  if (enabled.has("uploads") && env?.get("S3_ENDPOINT")) {
    add(await reach("Services", "Object storage", env.get("S3_ENDPOINT")!, run("db:up")))
  }

  const apiPort = Number(env?.get("API_PORT") || 3000)
  const webPort = Number(new URL(env?.get("WEB_URL") || "http://localhost:5173").port || 5173)
  for (const [label, port] of [["API", apiPort], ["Web", webPort]] as const) {
    const free = await portFree(port)
    add({
      group: "Services",
      title: free ? `Port ${port} (${label}) is free` : `Port ${port} (${label}) is in use`,
      status: free ? "ok" : "info",
      detail: free ? undefined : "fine if that's your dev server already running",
    })
  }

  /* ─── Database schema ──────────────────────────────────────────────── */
  const generated = existsSync(join(root, "packages/db/src/generated/prisma"))
  add({
    group: "Database",
    title: generated ? "Prisma client is generated" : "Prisma client hasn't been generated",
    status: generated ? "ok" : "fail",
    hint: generated ? undefined : run("db:generate"),
  })
  const migrationsDir = join(root, "packages/db/prisma/migrations")
  const migrations = existsSync(migrationsDir) ? readdirSync(migrationsDir).filter((d) => /^\d/.test(d)) : []
  add({
    group: "Database",
    title: migrations.length ? `${migrations.length} migration(s)` : "No migrations yet",
    status: migrations.length ? "ok" : "warn",
    hint: migrations.length ? undefined : `${run("db:migrate")} creates the first one`,
  })

  /* ─── Dependency versions ──────────────────────────────────────────── */
  const manifests = await glob(["package.json", "apps/*/package.json", "packages/*/package.json"], { cwd: root })
  const declared = new Map<string, Map<string, string[]>>()
  for (const file of manifests) {
    const pkg = JSON.parse(readFileSync(join(root, file), "utf8")) as Record<string, Record<string, string> | undefined>
    // Peer ranges are meant to be broad, so only real dependencies are compared.
    for (const field of ["dependencies", "devDependencies"]) {
      for (const [name, range] of Object.entries(pkg[field] ?? {})) {
        if (range.startsWith("workspace:") || range === "*") continue
        const byRange = declared.get(name) ?? new Map<string, string[]>()
        byRange.set(range, [...(byRange.get(range) ?? []), file.replace("/package.json", "") || "root"])
        declared.set(name, byRange)
      }
    }
  }
  const mismatched = [...declared].filter(([, ranges]) => ranges.size > 1)
  add({
    group: "Dependencies",
    title: mismatched.length ? `${mismatched.length} package(s) declared with different versions` : "Shared dependencies agree on versions",
    status: mismatched.length ? "warn" : "ok",
    detail: mismatched
      .slice(0, 6)
      .map(([name, ranges]) => `${name}: ${[...ranges].map(([range, where]) => `${range} (${where.join(", ")})`).join(" vs ")}`)
      .join("\n"),
    hint: mismatched.length ? "Align them so every package uses one version" : undefined,
  })

  const lockstep: Array<[string, RegExp]> = [
    ["Prisma", /^(prisma|@prisma\/)/],
    ["Better Auth", /^(better-auth|@better-auth\/)/],
    ["NestJS core", /^@nestjs\/(core|common|platform-express|platform-fastify)$/],
    ["React", /^(react|react-dom|@types\/react|@types\/react-dom)$/],
  ]
  for (const [label, pattern] of lockstep) {
    const versions = new Set<string>()
    for (const [name, ranges] of declared) {
      if (!pattern.test(name)) continue
      for (const range of ranges.keys()) versions.add(range.replace(/^[\^~]/, "").split(".").slice(0, 2).join("."))
    }
    if (versions.size > 1) {
      add({
        group: "Dependencies",
        title: `${label} packages are on different versions`,
        status: "warn",
        detail: [...versions].join(" vs "),
        hint: "Upgrade them together (Renovate groups them for you)",
      })
    }
  }

  // Did someone rename a module id the template no longer has?
  try {
    const manifest = loadManifest(resolveTemplate(config.template === "bundled" ? undefined : config.template, root).dir)
    const unknown = [...enabled].filter((id) => !manifest.options[id])
    if (unknown.length) {
      add({ group: "Dependencies", title: `klin.json mentions unknown modules: ${unknown.join(", ")}`, status: "warn" })
    }
  } catch {
    // Custom templates may be unavailable offline; not a health problem.
  }

  spin.stop("Checked everything")

  /* ─── Report ───────────────────────────────────────────────────────── */
  for (const group of [...new Set(checks.map((c) => c.group))]) {
    console.log(`\n  ${c.bold(group)}`)
    for (const check of checks.filter((c) => c.group === group)) {
      console.log(`    ${ICON[check.status]} ${check.title}`)
      if (check.detail) for (const line of check.detail.split("\n")) console.log(`      ${c.dim(line)}`)
      if (check.hint) console.log(`      ${c.dim(sym.arrow)} ${c.code(check.hint)}`)
    }
  }
  console.log()

  const fails = checks.filter((c) => c.status === "fail").length
  const warns = checks.filter((c) => c.status === "warn").length
  const passed = checks.filter((c) => c.status === "ok").length
  const summary = `${passed} passed · ${warns} warning${warns === 1 ? "" : "s"} · ${fails} problem${fails === 1 ? "" : "s"}`
  if (fails) {
    outro(`${c.error(summary)} — fix the ${c.error(sym.cross)} items and run me again.`)
    process.exitCode = 1
  } else if (warns) {
    outro(`${c.warn(summary)} — almost spotless.`)
  } else {
    outro(`${shimmer(`${summary} — spotless ${sym.star}`)}`)
  }
}

/** TCP-connects to the host:port in a URL (no driver needed). */
async function reach(group: string, label: string, url: string, hint: string): Promise<Check> {
  let host: string
  let port: number
  try {
    const parsed = new URL(url)
    host = parsed.hostname || "localhost"
    const defaults: Record<string, number> = { "postgresql:": 5432, "postgres:": 5432, "mysql:": 3306, "redis:": 6379, "rediss:": 6380, "http:": 80, "https:": 443 }
    port = Number(parsed.port) || defaults[parsed.protocol] || 80
  } catch {
    return { group, title: `${label} URL is malformed`, status: "fail", detail: url }
  }
  const ok = await new Promise<boolean>((resolve) => {
    const socket = connect({ host, port, timeout: 1500 })
    socket.once("connect", () => {
      socket.destroy()
      resolve(true)
    })
    socket.once("timeout", () => {
      socket.destroy()
      resolve(false)
    })
    socket.once("error", () => resolve(false))
  })
  return {
    group,
    title: ok ? `${label} is reachable at ${host}:${port}` : `${label} isn't reachable at ${host}:${port}`,
    status: ok ? "ok" : "fail",
    hint: ok ? undefined : hint,
  }
}

function portFree(port: number) {
  return new Promise<boolean>((resolve) => {
    const server = createServer()
    server.once("error", () => resolve(false))
    server.once("listening", () => server.close(() => resolve(true)))
    server.listen(port, "127.0.0.1")
  })
}
