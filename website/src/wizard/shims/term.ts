import type { Canvas } from "@cli/ui/canvas"
import { introRunning, playIntro } from "@cli/ui/logo"
import { terminalSize } from "./process"

/**
 * The browser twin of the CLI's full-screen `screen` (src/ui/term.ts): same
 * methods, but frames go to whatever on-page terminal attached itself, and
 * keys come from the page instead of stdin.
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

export interface Sink {
  draw(canvas: Canvas): void
}

export const interactive = true

class Screen {
  private active = false
  private view: View | undefined
  private sink: Sink | undefined
  private sweep: ReturnType<typeof setInterval> | undefined

  get isOpen() {
    return this.active
  }

  get size() {
    return { width: terminalSize.columns, height: terminalSize.rows }
  }

  attach(sink: Sink) {
    this.sink = sink
    this.paint()
  }

  /** The band of light across the logo, as when the CLI's screen first opens. */
  playIntro() {
    playIntro()
    clearInterval(this.sweep)
    this.sweep = setInterval(() => {
      this.paint()
      if (!introRunning()) clearInterval(this.sweep)
    }, 40)
  }

  open() {
    this.active = true
  }

  close() {
    this.active = false
    this.view = undefined
  }

  present(view: View) {
    this.open()
    this.view = view
    this.paint()
  }

  paint() {
    if (!this.active || !this.view || !this.sink) return
    this.sink.draw(this.view.render(terminalSize.columns, terminalSize.rows))
  }

  key(key: Key) {
    this.view?.key(key)
  }

  remember(_line: string) {}
}

export const screen = new Screen()
