import { emitKeypressEvents } from "node:readline"
import type { Canvas } from "./canvas"
import { introRunning, playIntro } from "./logo"

/**
 * The full-screen session: the alternate screen buffer, raw keyboard input,
 * redraws on resize, and a guaranteed clean exit. Prompts open it on demand;
 * anything that prints a regular line closes it first, so the transcript of
 * answers lands in the normal scrollback.
 */

export interface Key {
  name?: string
  sequence: string
  ctrl: boolean
  shift: boolean
  meta: boolean
}

export interface View {
  render(width: number, height: number): Canvas
  key(key: Key): void
}

export const interactive = Boolean(process.stdin.isTTY && process.stdout.isTTY && !process.env.CI)

const ENTER = "\x1b[?1049h\x1b[?25l\x1b[?7l"
const LEAVE = "\x1b[?7h\x1b[?25h\x1b[?1049l"

class Screen {
  private active = false
  private view: View | undefined
  private transcript: string[] = []
  private keypressReady = false
  private introPlayed = false

  private readonly onKeypress = (_: string | undefined, raw: Partial<Key> | undefined) => {
    const key: Key = {
      name: raw?.name,
      sequence: raw?.sequence ?? _ ?? "",
      ctrl: Boolean(raw?.ctrl),
      shift: Boolean(raw?.shift),
      meta: Boolean(raw?.meta),
    }
    this.view?.key(key)
  }

  private readonly onResize = () => this.paint()

  get isOpen() {
    return this.active
  }

  get size() {
    return { width: process.stdout.columns || 80, height: process.stdout.rows || 24 }
  }

  open() {
    if (this.active || !interactive) return
    this.active = true
    if (!this.keypressReady) {
      emitKeypressEvents(process.stdin)
      this.keypressReady = true
    }
    process.stdin.setRawMode(true)
    process.stdin.resume()
    process.stdin.on("keypress", this.onKeypress)
    process.stdout.on("resize", this.onResize)
    process.stdout.write(ENTER)
    // The first time the screen opens, a band of light sweeps across the logo.
    if (!this.introPlayed) {
      this.introPlayed = true
      playIntro()
      const timer = setInterval(() => {
        this.paint()
        if (!introRunning()) clearInterval(timer)
      }, 40)
    }
  }

  /** Leaves the full screen and prints what was answered while it was up. */
  close() {
    if (!this.active) return
    this.active = false
    this.view = undefined
    process.stdin.off("keypress", this.onKeypress)
    process.stdout.off("resize", this.onResize)
    process.stdin.setRawMode(false)
    process.stdin.pause()
    process.stdout.write(LEAVE)
    const lines = this.transcript.splice(0)
    if (lines.length) process.stdout.write(`${lines.join("\n")}\n`)
  }

  /** Shows `view` (opening the screen if needed) and paints it. */
  present(view: View) {
    this.open()
    this.view = view
    this.paint()
  }

  /** Repaints the current view, e.g. after its state changed. */
  paint() {
    if (!this.active || !this.view) return
    const { width, height } = this.size
    const frame = this.view.render(width, height)
    // Synchronized output: the terminal swaps in the whole frame at once.
    process.stdout.write(`\x1b[?2026h${frame.toAnsi()}\x1b[?2026l`)
  }

  /** A line for the scrollback, printed when the screen closes. */
  remember(line: string) {
    if (this.active) this.transcript.push(line)
    else process.stdout.write(`${line}\n`)
  }
}

export const screen = new Screen()

process.on("exit", () => screen.close())
for (const signal of ["SIGTERM", "SIGHUP"] as const) {
  process.once(signal, () => {
    screen.close()
    process.exit(130)
  })
}
