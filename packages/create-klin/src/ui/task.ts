import { centered, log } from "./log"
import { screen } from "./term"
import { c, gray, paint, pick, sym, unicode, width } from "./theme"

export const INSTALL_QUIPS = [
  "fluffing node_modules",
  "untangling the dependency graph",
  "politely asking the registry for packages",
  "dusting off Prisma",
  "polishing every semver range",
  "folding the TypeScript types neatly",
  "vacuuming under the lockfile",
  "teaching Turborepo where everything goes",
  "alphabetizing the junk drawer",
]

const FRAMES = unicode ? ["◐", "◓", "◑", "◒"] : ["-", "\\", "|", "/"]

export interface TaskOptions<T> {
  /** Rotating one-liners for slow steps. */
  quips?: string[]
  /** The line shown when it succeeds (defaults to the title). */
  done?: (result: T) => string
  /** Centered in the terminal, without the rail — for output that follows the full-screen UI. */
  center?: boolean
}

/** Runs a step and reports it; the default reporter is a line spinner. */
export type TaskReporter = <T>(
  title: string,
  fn: (update: (message: string) => void) => Promise<T>,
  options: TaskOptions<T>
) => Promise<T>

let reporter: TaskReporter | undefined

/** The full-screen build view takes over task reporting while it's up. */
export function setTaskReporter(next: TaskReporter | undefined) {
  reporter = next
}

/**
 * A step with a grayscale spinner and an elapsed timer. Resolves with fn's
 * result; on error it marks the step failed and rethrows.
 */
export function task<T>(
  title: string,
  fn: (update: (message: string) => void) => Promise<T>,
  options: TaskOptions<T> = {}
): Promise<T> {
  return (reporter ?? lineTask)(title, fn, options)
}

const seconds = (started: number) => `${((Date.now() - started) / 1000).toFixed(1)}s`

/**
 * A one-line grayscale spinner for work that isn't a single function call.
 * `update` changes the detail text; `stop` replaces it with a ✓ line.
 */
export function spinner(title: string, options: { center?: boolean } = {}) {
  screen.close()
  const started = Date.now()
  let detail = ""
  if (!process.stdout.isTTY) {
    if (options.center) {
      return {
        update: (message: string) => void (detail = message),
        stop: (line = title) => centered([`${c.bright(sym.check)}  ${line} ${c.dim(`(${seconds(started)})`)}`]),
        fail: (line = title) => centered([`${c.error(sym.cross)}  ${line} ${c.dim("failed")}`]),
      }
    }
    return {
      update: (message: string) => void (detail = message),
      stop: (line = title) => log.success(`${line} ${c.dim(`(${seconds(started)})`)}`),
      fail: (line = title) => log.error(`${line} ${c.dim("failed")}`),
    }
  }
  // Centered lines are re-centered on every frame, as the detail and timer change their width.
  const place = (line: string) =>
    options.center ? " ".repeat(Math.max(0, Math.floor(((process.stdout.columns || 80) - width(line)) / 2))) + line : line
  let frame = 0
  const draw = () => {
    const icon = paint(FRAMES[frame++ % FRAMES.length]!, { fg: [gray.bright, gray.bright, gray.bright] })
    process.stdout.write(`\r\x1b[2K${place(`${icon}  ${c.bright(title)} ${c.dim(detail)} ${c.faint(seconds(started))}`)}`)
  }
  process.stdout.write(`${options.center ? "" : `${c.faint(unicode ? "│" : "|")}\n`}\x1b[?25l`)
  const timer = setInterval(draw, 90)
  draw()
  const finish = (line: string) => {
    clearInterval(timer)
    process.stdout.write(`\r\x1b[2K${place(line)}\n\x1b[?25h`)
  }
  return {
    update: (message: string) => void (detail = message),
    stop: (line = title) => finish(`${c.bright(sym.check)}  ${line} ${c.faint(seconds(started))}`),
    fail: (line = title) => finish(`${c.error(sym.cross)}  ${line} ${c.dim("failed")}`),
  }
}

async function lineTask<T>(
  title: string,
  fn: (update: (message: string) => void) => Promise<T>,
  options: TaskOptions<T>
): Promise<T> {
  const spin = spinner(title, { center: options.center })
  const quips = options.quips && process.stdout.isTTY ? setInterval(() => spin.update(`· ${pick(options.quips!)}`), 2800) : undefined
  try {
    const result = await fn(spin.update)
    spin.stop(options.done ? options.done(result) : title)
    return result
  } catch (error) {
    spin.fail(title)
    throw error
  } finally {
    if (quips) clearInterval(quips)
  }
}
