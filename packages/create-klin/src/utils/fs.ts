import { existsSync, readdirSync } from "node:fs"
import { chmod, mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import type { FileMap } from "../engine/render"

export function isEmptyDir(dir: string) {
  if (!existsSync(dir)) return true
  return readdirSync(dir).filter((f) => f !== ".git" && f !== ".DS_Store").length === 0
}

export async function writeFileMap(root: string, files: FileMap) {
  for (const [path, file] of files) {
    const abs = join(root, path)
    await mkdir(dirname(abs), { recursive: true })
    await writeFile(abs, file.content)
    if (file.mode & 0o111) await chmod(abs, file.mode)
  }
}
