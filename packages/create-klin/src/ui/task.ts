import { log, spinner } from "@clack/prompts"
import { gradient, pc, pick, unicode } from "./theme"

const FRAMES = unicode ? ["✶", "✸", "✹", "✺", "✹", "✷"] : ["-", "\\", "|", "/"]

export const INSTALL_QUIPS = [
  "fluffing node_modules",
  "untangling the dependency graph",
  "politely asking npm for packages",
  "dusting off Prisma",
  "polishing every semver range",
  "folding the TypeScript types neatly",
  "vacuuming under the lockfile",
  "teaching Turborepo where everything goes",
  "alphabetizing the junk drawer",
]

/**
 * A spinner step: sparkle animation, elapsed timer, optional rotating quips
 * for slow work. Resolves with fn's result; on error it marks the step failed
 * and rethrows.
 */
export async function task<T>(
  title: string,
  fn: (update: (message: string) => void) => Promise<T>,
  options: { quips?: string[]; done?: (result: T) => string } = {}
): Promise<T> {
  // Pipes and CI logs get plain lines instead of animation frames.
  if (!process.stdout.isTTY) {
    const started = Date.now()
    try {
      const result = await fn(() => {})
      log.success(`${options.done ? options.done(result) : title} ${pc.dim(`(${((Date.now() - started) / 1000).toFixed(1)}s)`)}`)
      return result
    } catch (error) {
      log.error(`${title} ${pc.red("failed")}`)
      throw error
    }
  }

  let frame = 0
  const s = spinner({
    frames: FRAMES,
    indicator: "timer",
    styleFrame: (f) => gradient(f, undefined, (frame++ % 12) / 12),
  })
  s.start(title)
  let detail = ""
  const render = () => s.message(detail ? `${title} ${pc.dim(detail)}` : title)
  const timer = options.quips
    ? setInterval(() => {
        detail = `· ${pick(options.quips!)}`
        render()
      }, 2800)
    : undefined
  try {
    const result = await fn((message) => {
      detail = message
      render()
    })
    s.stop(options.done ? options.done(result) : title)
    return result
  } catch (error) {
    s.error(`${title} ${pc.red("failed")}`)
    throw error
  } finally {
    if (timer) clearInterval(timer)
  }
}
