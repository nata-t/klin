import { existsSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { z } from "zod"

/**
 * Server-side environment, validated once on import.
 *
 * Every server entrypoint (the API, seed scripts, tests) imports `env` from
 * here instead of reading `process.env` directly. If anything is missing or
 * malformed the process stops immediately with a readable list of problems —
 * no more "undefined is not a function" ten minutes into a request.
 *
 * Adding a variable: add it to the schema below and to `.env.example`.
 */

// klin:if oauth || email || uploads
/** Empty strings in .env mean "not set". */
const optional = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))

// klin:endif
export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  LOG_LEVEL: z
    .enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"])
    .default("info"),

  WEB_URL: z.url().default("http://localhost:5173"),
  API_PORT: z.coerce.number().int().positive().default(3000),

  DATABASE_URL: z.string().min(1, "is required"),

  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "must be at least 32 characters (try `openssl rand -base64 32`)"),
  BETTER_AUTH_URL: z.url(),
  // klin:if google

  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  // klin:endif
  // klin:if github

  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  // klin:endif
  // klin:if email

  RESEND_API_KEY: optional,
  EMAIL_FROM: z.string().min(1).default("Klin App <onboarding@resend.dev>"),
  // klin:endif
  // klin:if uploads

  S3_ENDPOINT: optional,
  S3_REGION: z.string().default("us-east-1"),
  S3_BUCKET: z.string().min(1, "is required"),
  S3_ACCESS_KEY_ID: z.string().min(1, "is required"),
  S3_SECRET_ACCESS_KEY: z.string().min(1, "is required"),
  S3_FORCE_PATH_STYLE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  // klin:endif
  // klin:if queues

  REDIS_URL: z.url().default("redis://localhost:6379"),
  // klin:endif
})

export type Env = z.infer<typeof envSchema>

/**
 * The monorepo root (the folder with `turbo.json`), found by walking up from
 * the current directory. Lets every app read the single root `.env` and
 * resolve relative paths the same way no matter where it was started from.
 */
export const repoRoot: string = (() => {
  let dir = process.cwd()
  while (true) {
    if (existsSync(join(dir, "turbo.json"))) return dir
    const parent = dirname(dir)
    if (parent === dir) return process.cwd()
    dir = parent
  }
})()

/** Resolves a path relative to the repository root. */
export function fromRoot(...segments: string[]): string {
  return resolve(repoRoot, ...segments)
}

function loadDotenv() {
  const file = join(repoRoot, ".env")
  // Real environment variables always win over the file (same as `node --env-file`).
  if (existsSync(file)) process.loadEnvFile(file)
}

function parseEnv(): Env {
  loadDotenv()
  const result = envSchema.safeParse(process.env)
  if (result.success) return result.data

  const lines = result.error.issues.map((issue) => {
    const key = issue.path.join(".") || "(root)"
    const message =
      issue.code === "invalid_type" && issue.input === undefined
        ? "is required"
        : issue.message
    return `  • ${key} ${message}`
  })
  console.error(
    [
      "",
      "✖ Invalid environment variables:",
      ...lines,
      "",
      "  Fix them in .env (see .env.example for every option).",
      "",
    ].join("\n")
  )
  process.exit(1)
}

export const env: Env = parseEnv()

export const isProduction = env.NODE_ENV === "production"
export const isDevelopment = env.NODE_ENV === "development"
export const isTest = env.NODE_ENV === "test"
