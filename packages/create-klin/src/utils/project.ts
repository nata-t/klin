import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import type { Answers, PackageManager } from "../engine/manifest"

/** `klin.json` lives at the root of every generated project. */
export const PROJECT_FILE = "klin.json"

export interface ProjectConfig {
  $schema?: string
  /** create-klin version the project was generated (or last upgraded) with. */
  version: string
  /** Where the template came from: "bundled", a path, or "github:owner/repo". */
  template: string
  name: string
  /** e.g. "pnpm@11.20.0" */
  packageManager: string
  answers: Answers
  /** `klin generate` settings: where each layer's files go (`klin generate paths`). */
  generate?: { paths?: Partial<Record<"backend" | "frontend" | "validation" | "model", string>> }
}

export function findProjectRoot(from = process.cwd()): string | null {
  let dir = resolve(from)
  while (true) {
    if (existsSync(join(dir, PROJECT_FILE))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

export function readProject(root: string): ProjectConfig {
  const config = JSON.parse(readFileSync(join(root, PROJECT_FILE), "utf8")) as ProjectConfig
  if (!config.answers || !config.packageManager) {
    throw new Error(`${PROJECT_FILE} is missing "answers" or "packageManager"`)
  }
  return config
}

export function projectFileContent(config: ProjectConfig) {
  return `${JSON.stringify(config, null, 2)}\n`
}

export function writeProject(root: string, config: ProjectConfig) {
  writeFileSync(join(root, PROJECT_FILE), projectFileContent(config))
}

export function parsePackageManager(spec: string): { pm: PackageManager; version: string } {
  const [pm, version = ""] = spec.split("@") as [PackageManager, string?]
  return { pm, version }
}
