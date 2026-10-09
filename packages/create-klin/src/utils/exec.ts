import { spawn } from "node:child_process"

export interface RunResult {
  code: number
  /** Last ~200 lines of combined stdout/stderr, for error reports. */
  output: string
}

/**
 * Runs a command without a shell (except on Windows, where package managers
 * are .cmd shims), capturing output instead of printing it.
 */
export function run(
  command: string,
  args: string[],
  options: { cwd: string; env?: NodeJS.ProcessEnv; onLine?: (line: string) => void; inherit?: boolean }
): Promise<RunResult> {
  return new Promise((resolve) => {
    const lines: string[] = []
    let partial = ""
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, FORCE_COLOR: "0", ...options.env },
      shell: process.platform === "win32",
      stdio: options.inherit ? "inherit" : ["ignore", "pipe", "pipe"],
    })
    const onData = (chunk: Buffer) => {
      const text = partial + chunk.toString()
      const parts = text.split(/\r?\n/)
      partial = parts.pop() ?? ""
      for (const line of parts) {
        lines.push(line)
        if (lines.length > 200) lines.shift()
        options.onLine?.(line)
      }
    }
    child.stdout?.on("data", onData)
    child.stderr?.on("data", onData)
    child.on("error", (error) => {
      lines.push(error.message)
      resolve({ code: 127, output: lines.join("\n") })
    })
    child.on("close", (code) => {
      if (partial) lines.push(partial)
      resolve({ code: code ?? 1, output: lines.join("\n") })
    })
  })
}

export async function commandExists(command: string) {
  const { code } = await run(command, ["--version"], { cwd: process.cwd() })
  return code === 0
}
