import { Canvas, type Border } from "./canvas"
import { MINI_LOGO, MINI_LOGO_WIDTH } from "./logo"
import type { Key } from "./term"
import { colorEnabled, depth, type RGB, type Style, sym, truncate, unicode, width, wrap } from "./theme"

/**
 * One full-screen page of the CLI, centered on a softly vignetted background:
 *
 *                                                                   v0.2.0
 *        ██  ▄█▀ ██      ██ ███▄   ██
 *        ██▀▀█▄  ██      ██ ██ ▀█▄ ██    ✓ 1 BASE ┈┈ ◆ 2 STACK ┈┈ ○ 3 AUTH …
 *        ▀▀   ▀▀ ▀▀▀▀▀▀▀ ▀▀ ▀▀   ▀▀▀▀
 *
 *                           Pick your engine.
 *              How the API is built and where the data lives.
 *
 *                              FRAMEWORK
 *                     ╭────────────╮  ╭┄┄┄┄┄┄┄┄┄╮
 *                     │ ● NestJS   │  ┆ ○ Plain ┆
 *                     ╰────────────╯  ╰┄┄┄┄┄┄┄┄┄╯
 *
 *               ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *          NestJS · Modules, controllers and dependency injection,
 *               with nestjs-zod turning the shared schemas into DTOs.
 *             space snap   ←↑↓→ move   enter next   esc back
 *
 * Chips: a snapped chip has a solid border, a tinted fill and ✓ (● for
 * pick-one groups); a loose chip has a dashed border and + (○); the chip
 * under the cursor gets a heavy white border. All in grays.
 */

export interface ChipItem {
  id: string
  label: string
  /** Shown in the help panel while highlighted. */
  about?: string
  /** A real color to preview (the only non-gray ink). */
  swatch?: RGB | null
  /** Why it can't be picked. */
  disabled?: string
}

export interface ChipField {
  kind: "chips"
  id: string
  title: string
  note?: string
  multi: boolean
  items: ChipItem[]
  isOn(id: string): boolean
  /** Returns an optional notice for the help panel ("Email & password came along"). */
  toggle(id: string): string | void
}

export type Tone = "ok" | "warn" | "error"

export interface InputField {
  kind: "input"
  id: string
  label: string
  hint?: string
  about?: string
  placeholder?: string
  value: string
  caret: number
  /** Transforms each typed character ("" drops it). */
  filter?: (char: string) => string
  validate(value: string): { tone: Tone; message: string }
}

export interface SummaryField {
  kind: "summary"
  id: string
  rows: Array<[label: string, value: string]>
}

export interface ProgressField {
  kind: "progress"
  id: string
  rows: Array<{ status: "pending" | "running" | "done" | "failed"; title: string; detail?: string; time?: string }>
}

export type Field = ChipField | InputField | SummaryField | ProgressField

export interface Page {
  /** Next to the logo when there are no steps ("klin add · my-app"). */
  title?: string
  /** Top-right corner. */
  version?: string
  steps?: { labels: string[]; current: number }
  heading: string
  subtitle?: string
  fields: Field[]
  /** Key hints for the line at the bottom. */
  keys: Array<[key: string, action: string]>
  /** Help text when nothing is highlighted (summary/progress pages). */
  help?: { title: string; text: string }
}

export type Action = "submit" | "back" | "cancel" | "changed" | "none"

interface Placed {
  field: number
  item: number
  x: number
  y: number
  w: number
}

interface Modal {
  title: string
  text: string
  choices: Array<[key: string, label: string]>
}

const isInteractive = (field: Field | undefined): field is ChipField | InputField =>
  field?.kind === "chips" || field?.kind === "input"

const S = {
  bg: { bg: "bg" } satisfies Style,
  bar: { bg: "bar" } satisfies Style,
  line: { fg: "line" } satisfies Style,
  subtle: { fg: "subtle" } satisfies Style,
  muted: { fg: "muted" } satisfies Style,
  text: { fg: "text" } satisfies Style,
  bright: { fg: "bright" } satisfies Style,
  heading: { fg: "white", bold: true } satisfies Style,
}

export class Form {
  cursor = { field: 0, item: 0 }
  private placed: Placed[] = []
  private notice: { tone: Tone; text: string } | undefined
  modal: Modal | undefined
  private scroll = 0

  constructor(public page: Page) {
    this.focusFirst()
  }

  /** Moves the cursor to the first field that takes input. */
  focusFirst() {
    const index = this.page.fields.findIndex(isInteractive)
    this.cursor = { field: Math.max(0, index), item: 0 }
    const field = this.page.fields[this.cursor.field]
    if (field?.kind === "chips") {
      const on = field.items.findIndex((item) => field.isOn(item.id))
      if (!field.multi && on >= 0) this.cursor.item = on
    }
  }

  focus(fieldId: string) {
    const index = this.page.fields.findIndex((f) => f.id === fieldId)
    if (index >= 0) this.cursor = { field: index, item: 0 }
  }

  say(tone: Tone, text: string) {
    this.notice = { tone, text }
  }

  get focused(): Field | undefined {
    return this.page.fields[this.cursor.field]
  }

  /* ─── Keys ────────────────────────────────────────────────────────── */

  key(key: Key): Action {
    if (key.ctrl && key.name === "c") return "cancel"
    if (this.modal) return "none"
    const field = this.focused
    this.notice = undefined

    if (key.name === "return" || key.name === "enter") return "submit"
    if (key.name === "escape") return "back"
    if (key.name === "tab") return this.moveField(key.shift ? -1 : 1)

    if (field?.kind === "input") {
      if (key.name === "down") return this.moveField(1)
      if (key.name === "up") return this.moveField(-1)
      return this.edit(field, key)
    }
    if (field?.kind === "chips") {
      if (key.name === "left") return this.moveItem(field, -1)
      if (key.name === "right") return this.moveItem(field, 1)
      if (key.name === "up") return this.moveRow(-1)
      if (key.name === "down") return this.moveRow(1)
      if (key.name === "home") return this.moveItem(field, -Infinity)
      if (key.name === "end") return this.moveItem(field, Infinity)
      if (key.name === "space" || key.sequence === " ") {
        const item = field.items[this.cursor.item]
        if (!item) return "none"
        if (item.disabled) {
          this.say("warn", `${item.label}: ${item.disabled}`)
          return "changed"
        }
        const message = field.toggle(item.id)
        if (message) this.say("ok", message)
        return "changed"
      }
    }
    return "none"
  }

  private moveField(step: number): Action {
    const fields = this.page.fields
    let index = this.cursor.field
    for (let n = 0; n < fields.length; n++) {
      index += step
      if (index < 0 || index >= fields.length) return "none"
      if (isInteractive(fields[index])) break
    }
    if (!isInteractive(fields[index])) return "none"
    const field = fields[index]!
    let item = 0
    if (field.kind === "chips") {
      const on = field.items.findIndex((i) => field.isOn(i.id))
      item = !field.multi && on >= 0 ? on : 0
    }
    this.cursor = { field: index, item }
    return "changed"
  }

  private moveItem(field: ChipField, step: number): Action {
    const next = Math.min(field.items.length - 1, Math.max(0, this.cursor.item + step))
    if (next === this.cursor.item) return "none"
    this.cursor.item = next
    return "changed"
  }

  /** ↑/↓: the nearest chip in the visual row above/below (across groups). */
  private moveRow(step: number): Action {
    const here = this.placed.find((p) => p.field === this.cursor.field && p.item === this.cursor.item)
    if (!here) return this.moveField(step)
    const rows = [...new Set(this.placed.map((p) => p.y))].sort((a, b) => a - b)
    const target = rows[rows.indexOf(here.y) + step]
    if (target === undefined) {
      // Past the last chip row: hop to an input field, if there is one that way.
      const input = this.page.fields.findIndex((f, i) => f.kind === "input" && (step < 0 ? i < this.cursor.field : i > this.cursor.field))
      if (input >= 0) {
        this.cursor = { field: input, item: 0 }
        return "changed"
      }
      return "none"
    }
    const center = here.x + here.w / 2
    const candidates = this.placed.filter((p) => p.y === target)
    const best = candidates.sort((a, b) => Math.abs(a.x + a.w / 2 - center) - Math.abs(b.x + b.w / 2 - center))[0]!
    // Moving up out of the chips into an input field sitting above them.
    const between = this.page.fields.findIndex(
      (f, i) => f.kind === "input" && i > Math.min(best.field, this.cursor.field) && i < Math.max(best.field, this.cursor.field)
    )
    if (between >= 0) {
      this.cursor = { field: between, item: 0 }
      return "changed"
    }
    this.cursor = { field: best.field, item: best.item }
    return "changed"
  }

  private edit(field: InputField, key: Key): Action {
    const { value, caret } = field
    const set = (next: string, at: number) => {
      field.value = next
      field.caret = Math.max(0, Math.min(next.length, at))
      return "changed" as const
    }
    switch (key.name) {
      case "left":
        return set(value, caret - 1)
      case "right":
        return set(value, caret + 1)
      case "home":
        return set(value, 0)
      case "end":
        return set(value, value.length)
      case "backspace":
        return caret > 0 ? set(value.slice(0, caret - 1) + value.slice(caret), caret - 1) : "none"
      case "delete":
        return set(value.slice(0, caret) + value.slice(caret + 1), caret)
    }
    if (key.ctrl && key.name === "u") return set(value.slice(caret), 0)
    if (key.ctrl && key.name === "w") {
      const start = value.slice(0, caret).replace(/[^\s/-]*[\s/-]*$/, "").length
      return set(value.slice(0, start) + value.slice(caret), start)
    }
    if (key.ctrl || key.meta) return "none"
    const typed = [...(key.sequence ?? "")].filter((ch) => ch >= " " && ch !== "\x7f").join("")
    if (!typed) return "none"
    const text = field.filter ? [...typed].map(field.filter).join("") : typed
    if (!text) return "none"
    return set(value.slice(0, caret) + text + value.slice(caret), caret + text.length)
  }

  /* ─── Render ──────────────────────────────────────────────────────── */

  render(w: number, h: number): Canvas {
    const canvas = new Canvas(w, h, S.bg)
    canvas.vignette(0x1a, 0x0f)
    this.placed = []

    if (w < 40 || h < 12) {
      const lines = ["klin needs a little more room.", `Make the terminal at least 40×12 (now ${w}×${h}).`]
      lines.forEach((line, i) => center(canvas, 0, w, Math.floor(h / 2) - 1 + i, truncate(line, w), i ? S.muted : S.bright))
      return canvas
    }

    const top = this.header(canvas, w, h)
    const bottom = this.footer(canvas, w, h)

    // The page body, centered both ways in what's left.
    const avail = bottom - top
    const bodyW = Math.min(w - 4, 92)
    const left = Math.floor((w - bodyW) / 2)
    let boxed = true
    let blocks = this.layout(bodyW, boxed)
    if (sum(blocks) > avail) {
      boxed = false
      blocks = this.layout(bodyW, boxed)
    }
    const height = sum(blocks)
    if (height <= avail) this.scroll = 0
    else {
      const [from, to] = this.focusOffset(blocks)
      if (from - this.scroll < 0) this.scroll = from
      if (to - this.scroll > avail) this.scroll = to - avail
      this.scroll = Math.max(0, Math.min(this.scroll, height - avail))
    }
    let y = height <= avail ? top + Math.floor((avail - height) / 2) : top - this.scroll
    canvas.clip = { top, bottom }
    for (const block of blocks) {
      if (y + block.height > top && y < bottom) block.draw(canvas, left, y, bodyW)
      y += block.height
    }
    canvas.clip = undefined

    if (this.modal) this.drawModal(canvas, w, h)
    return canvas
  }

  /**
   * The KLIN logo with the step indicator (or the page title) beside it, or
   * under it when there isn't room; a one-line wordmark on short terminals.
   * Returns the first row free for the body.
   */
  private header(canvas: Canvas, w: number, h: number): number {
    if (this.page.version && w >= 50) canvas.text(w - width(this.page.version) - 2, 0, this.page.version, { fg: "line" })
    const steps = this.page.steps
    const title = this.page.title ?? ""
    const big = h >= 28 && w >= 64
    const logo = big ? MINI_LOGO : ["K L I N"]
    const logoW = big ? MINI_LOGO_WIDTH : width(logo[0]!)
    // A little depth: the letters fade from white at the top to gray at the bottom.
    const shades: Style[] = [{ fg: "white" }, { fg: [0xdc, 0xdc, 0xdc] }, { fg: [0xa8, 0xa8, 0xa8] }]
    const drawLogo = (x: number, y: number) =>
      logo.forEach((line, i) => canvas.text(x, y + i, line, big ? shades[i]! : { fg: "white", bold: true }))
    const y = 1

    // Beside the logo when it fits there: the full indicator next to the big
    // logo, any length of it next to the one-line wordmark.
    const besideRoom = w - 6 - logoW - 4
    const beside = steps ? stepSegments(steps, besideRoom, big ? 1 : 3) : title ? ([[title, S.muted]] as Segment[]) : []
    if (beside && segmentsWidth(beside) <= besideRoom) {
      const groupW = logoW + (beside.length ? 4 + segmentsWidth(beside) : 0)
      const x = Math.floor((w - groupW) / 2)
      drawLogo(x, y)
      drawSegments(canvas, x + logoW + 4, y + Math.floor((logo.length - 1) / 2), beside)
      return y + logo.length + 1
    }
    // Otherwise stacked: the logo, then the indicator (shortened to fit) under it.
    drawLogo(Math.floor((w - logoW) / 2), y)
    const below = steps ? (stepSegments(steps, w - 4, 3) ?? []) : ([[truncate(title, w - 4), S.muted]] as Segment[])
    const belowY = y + logo.length + (big ? 1 : 0)
    drawSegments(canvas, Math.floor((w - segmentsWidth(below)) / 2), belowY, below)
    return belowY + 2
  }

  /** The help paragraph and the key hints, centered. Returns the row above them. */
  private footer(canvas: Canvas, w: number, h: number): number {
    // Keys: one quiet line on the last row (dropping hints from the end if it's narrow).
    const hints = this.keys()
    let keyLine: Segment[] = []
    for (let count = hints.length; count > 0; count--) {
      keyLine = hints.slice(0, count).flatMap(([cap, action], i) => [
        ...(i ? ([["   ", {}]] as Segment[]) : []),
        [cap, { fg: "text", bold: true }] as Segment,
        [` ${action}`, S.subtle] as Segment,
      ])
      if (segmentsWidth(keyLine) <= w - 4) break
    }
    drawSegments(canvas, Math.floor((w - segmentsWidth(keyLine)) / 2), h - 1, keyLine)

    // Help: the highlighted thing's name in bold, then what it does — wrapped and centered.
    const blockW = Math.min(w - 6, 84)
    const rows = h >= 24 ? 3 : 2
    const helpTop = h - 2 - rows
    const rule = Math.min(blockW, 64)
    canvas.hline(Math.floor((w - rule) / 2), helpTop - 1, rule, S.line, unicode ? "┄" : "-")
    const content = this.helpContent()
    if (content) {
      const loud = content.tone === "error" || content.tone === "warn"
      const lines = wrap(content.text ? `${content.title} · ${content.text}` : content.title, blockW)
      const shown = lines.slice(0, rows)
      if (lines.length > rows) shown[rows - 1] = truncate(`${shown[rows - 1]} …`, blockW)
      shown.forEach((line, i) => {
        const x = Math.floor((w - width(line)) / 2)
        if (i === 0 && line.startsWith(content.title)) {
          const after = canvas.text(x, helpTop, content.title, { fg: loud ? "white" : "bright", bold: true })
          canvas.text(after, helpTop, line.slice(content.title.length), S.muted)
        } else canvas.text(x, helpTop + i, line, S.muted)
      })
    }
    return helpTop - 2
  }

  /** Key hints, adjusted to what has focus. */
  private keys(): Array<[string, string]> {
    const field = this.focused
    if (this.modal) return this.modal.choices
    if (field?.kind === "input") {
      return this.page.keys.map(([cap, action]) => (cap === "space" ? ["type", "edit"] : [cap, action]) as [string, string])
    }
    return this.page.keys
  }

  private helpContent(): { title: string; text: string; tone?: Tone } | undefined {
    if (this.modal) return { title: this.modal.title, text: this.modal.text, tone: "warn" }
    if (this.notice) {
      const icon = this.notice.tone === "ok" ? sym.check : this.notice.tone === "warn" ? sym.warn : sym.cross
      return { title: icon, text: this.notice.text, tone: this.notice.tone }
    }
    const field = this.focused
    if (field?.kind === "chips") {
      const item = field.items[this.cursor.item]
      if (item) return { title: item.label, text: item.disabled ? `${item.disabled}.` : (item.about ?? "") }
    }
    if (field?.kind === "input") return { title: field.label, text: field.about ?? "" }
    if (this.page.help) return this.page.help
    return undefined
  }

  /* Blocks: the page as a vertical list of drawable pieces. */
  private layout(mainW: number, boxed: boolean): Block[] {
    const blocks: Block[] = []
    const page = this.page
    blocks.push({
      height: page.subtitle ? 3 : 2,
      draw: (c, x, y, w) => {
        center(c, x, w, y, truncate(page.heading, w), S.heading)
        if (page.subtitle) center(c, x, w, y + 1, truncate(page.subtitle, w), S.muted)
      },
    })
    page.fields.forEach((field, index) => {
      const focused = index === this.cursor.field
      if (field.kind === "chips") blocks.push(this.chipBlock(field, index, mainW, boxed, focused))
      else if (field.kind === "input") blocks.push(inputBlock(field, focused))
      else if (field.kind === "summary") blocks.push(summaryBlock(field))
      else blocks.push(progressBlock(field))
    })
    return blocks
  }

  /** Where the focused field sits in the laid-out page: [top, bottom). */
  private focusOffset(blocks: Block[]): [number, number] {
    // Blocks are: the heading, then one per field.
    const index = this.cursor.field + 1
    const top = sum(blocks.slice(0, index))
    return [top, top + (blocks[index]?.height ?? 0)]
  }

  private chipBlock(field: ChipField, index: number, maxW: number, boxed: boolean, focused: boolean): Block {
    const gap = boxed ? 2 : 1
    const chipW = (item: ChipItem) => width(item.label) + (item.swatch ? 2 : 0) + (boxed ? 6 : 4)
    const rows: ChipItem[][] = [[]]
    let used = 0
    for (const item of field.items) {
      const cw = Math.min(chipW(item), maxW)
      if (used && used + gap + cw > maxW) {
        rows.push([])
        used = 0
      }
      rows[rows.length - 1]!.push(item)
      used += (used ? gap : 0) + cw
    }
    const rowH = boxed ? 3 : 1
    const rowGap = boxed ? 0 : 1
    const height = 1 + rows.length * rowH + (rows.length - 1) * rowGap + 1 + 1
    return {
      height,
      draw: (canvas, x, y, w) => {
        const title = field.title.toUpperCase()
        const note = field.note && w - width(title) >= 2 * (width(field.note) + 4) ? `  ${sym.dot} ${field.note}` : ""
        // The title sits dead center over the chips; the note trails off to its right.
        const col = x + Math.floor((w - width(title)) / 2)
        const after = canvas.text(col, y, title, focused ? { fg: "text", bold: true } : { fg: "subtle", bold: true })
        canvas.text(after, y, note, { fg: "line" })
        let rowY = y + 1
        for (const row of rows) {
          const rowW = row.reduce((sum, item) => sum + Math.min(chipW(item), maxW), 0) + gap * (row.length - 1)
          let cx = x + Math.floor((w - rowW) / 2)
          for (const item of row) {
            const itemIndex = field.items.indexOf(item)
            const cw = Math.min(chipW(item), maxW)
            const isCursor = focused && itemIndex === this.cursor.item
            drawChip(canvas, cx, rowY, cw, item, field.isOn(item.id), field.multi, isCursor, boxed)
            this.placed.push({ field: index, item: itemIndex, x: cx, y: rowY, w: cw })
            cx += cw + gap
          }
          rowY += rowH + rowGap
        }
      },
    }
  }

  private drawModal(canvas: Canvas, w: number, h: number) {
    const modal = this.modal!
    const boxW = Math.min(w - 8, 64)
    const text = wrap(modal.text, boxW - 6)
    const boxH = text.length + 6
    const x = Math.floor((w - boxW) / 2)
    const y = Math.floor((h - boxH) / 2)
    canvas.fill(x - 1, y, boxW + 2, boxH, { bg: "bar" })
    canvas.box(x, y, boxW, boxH, "heavy", { fg: "white" }, { bg: "bar" })
    canvas.text(x + 3, y + 1, modal.title, { fg: "white", bold: true }, boxW - 6)
    text.forEach((line, i) => canvas.text(x + 3, y + 2 + i, line, S.muted))
    let col = x + 3
    for (const [key, label] of modal.choices) {
      col = canvas.text(col, y + boxH - 2, ` ${key} `, depth >= 256 ? { fg: "bg", bg: "bright", bold: true } : { inverse: true })
      col = canvas.text(col + 1, y + boxH - 2, label, S.text) + 3
    }
  }
}

interface Block {
  height: number
  draw(canvas: Canvas, x: number, y: number, w: number): void
}

const sum = (blocks: Block[]) => blocks.reduce((total, block) => total + block.height, 0)

function drawChip(canvas: Canvas, x: number, y: number, w: number, item: ChipItem, on: boolean, multi: boolean, cursor: boolean, boxed: boolean) {
  const glyph = multi ? (on ? sym.check : "+") : on ? (unicode ? "●" : "*") : unicode ? "○" : "o"
  const disabled = Boolean(item.disabled)
  const labelStyle: Style = disabled
    ? { fg: "line", strike: true }
    : on
      ? { fg: "white", bold: true }
      : cursor
        ? { fg: "bright" }
        : { fg: "text" }
  const glyphStyle: Style = disabled ? { fg: "line" } : on ? { fg: "white", bold: true } : { fg: cursor ? "bright" : "subtle" }

  if (boxed) {
    const border: Border = cursor ? "heavy" : on ? "solid" : "dashed"
    const borderStyle: Style = cursor ? { fg: "white" } : on ? { fg: "muted" } : { fg: "line" }
    const fill: Style | undefined = on ? { bg: cursor ? "lift" : "tint" } : cursor ? { bg: "tint" } : undefined
    canvas.box(x, y, w, 3, border, borderStyle, fill)
    let col = canvas.text(x + 2, y + 1, glyph, glyphStyle)
    col += 1
    if (item.swatch) col = canvas.text(col, y + 1, colorEnabled && depth >= 256 ? "■" : sym.block, depth >= 256 ? { fg: item.swatch } : { fg: "bright" }) + 1
    canvas.text(col, y + 1, item.label, labelStyle, x + w - 2 - col)
    return
  }
  // Compact: one line, the fill does the talking — the cursor is inverted.
  if (cursor) {
    const inverted: Style = depth >= 256 ? { fg: "bg", bg: "bright", bold: true } : { inverse: true, bold: true }
    canvas.fill(x, y, w, 1, inverted)
    let at = canvas.text(x + 1, y, glyph, inverted) + 1
    if (item.swatch) at = canvas.text(at, y, "■", depth >= 256 ? { ...inverted, fg: item.swatch } : inverted) + 1
    canvas.text(at, y, item.label, disabled ? { ...inverted, strike: true } : inverted, x + w - 1 - at)
    return
  }
  const bg: Style = on ? { bg: "tint" } : {}
  canvas.fill(x, y, w, 1, bg)
  let col = canvas.text(x + 1, y, glyph, { ...glyphStyle, ...bg })
  col += 1
  if (item.swatch) col = canvas.text(col, y, "■", depth >= 256 ? { fg: item.swatch, ...bg } : { fg: "bright", ...bg }) + 1
  canvas.text(col, y, item.label, { ...labelStyle, ...bg }, x + w - 1 - col)
}

function inputBlock(field: InputField, focused: boolean): Block {
  return {
    height: 6,
    draw: (canvas, x, y, w) => {
      const boxW = Math.min(w, 58)
      const bx = x + Math.floor((w - boxW) / 2)
      // Label, box and verdict all centered on the same axis.
      const label: Segment[] = [
        [`${sym.diamond} `, focused ? { fg: "white" } : S.subtle],
        [field.label, { fg: focused ? "white" : "text", bold: true }],
        ...(field.hint && width(field.label) + width(field.hint) + 3 <= w ? ([[` ${field.hint}`, S.subtle]] as Segment[]) : []),
      ]
      drawSegments(canvas, x + Math.floor((w - segmentsWidth(label)) / 2), y, label)
      canvas.box(bx, y + 1, boxW, 3, focused ? "solid" : "dashed", focused ? { fg: "muted" } : S.line, { bg: "bar" })
      const inner = boxW - 6
      // Keep the caret in view for long values.
      const start = Math.max(0, field.caret - inner + 1)
      const visible = field.value.slice(start, start + inner)
      const col = canvas.text(bx + 2, y + 2, sym.caret, focused ? { fg: "white", bold: true } : S.subtle)
      if (!field.value && field.placeholder) canvas.text(col + 1, y + 2, field.placeholder, S.subtle, inner)
      canvas.text(col + 1, y + 2, visible, { fg: "white", bold: true }, inner)
      if (focused) {
        const under = field.value[field.caret] ?? " "
        canvas.text(col + 1 + (field.caret - start), y + 2, under, depth >= 256 ? { fg: "bg", bg: "bright" } : { inverse: true })
      }
      const result = field.validate(field.value)
      const icon = result.tone === "ok" ? sym.check : result.tone === "warn" ? sym.warn : sym.cross
      center(canvas, x, w, y + 4, truncate(`${icon} ${result.message}`, w), result.tone === "ok" ? S.muted : { fg: "white", bold: true })
    },
  }
}

function summaryBlock(field: SummaryField): Block {
  // Long values wrap onto extra lines instead of being cut off.
  const layoutRows = (w: number) => {
    const labelW = Math.max(...field.rows.map(([label]) => width(label)))
    const valueW = Math.max(12, Math.min(w - labelW - 3, 60))
    const lines = field.rows.flatMap(([label, value]) => wrap(value, valueW).map((part, i) => [i ? "" : label, part] as const))
    const blockW = labelW + 3 + Math.max(...lines.map(([, part]) => width(part)))
    return { labelW, lines, blockW }
  }
  return {
    height: layoutRows(92).lines.length + 1,
    draw: (canvas, x, y, w) => {
      const { labelW, lines, blockW } = layoutRows(w)
      const startX = x + Math.max(0, Math.floor((w - blockW) / 2))
      lines.forEach(([label, value], i) => {
        canvas.text(startX + labelW - width(label), y + i, label, S.subtle)
        canvas.text(startX + labelW + 3, y + i, value, S.bright)
      })
    },
  }
}

const SPIN = unicode ? ["◐", "◓", "◑", "◒"] : ["-", "\\", "|", "/"]

function progressBlock(field: ProgressField): Block {
  return {
    height: field.rows.length + 1,
    draw: (canvas, x, y, w) => {
      const rowW = Math.min(w, 70)
      const startX = x + Math.floor((w - rowW) / 2)
      const frame = SPIN[Math.floor(Date.now() / 120) % SPIN.length]!
      field.rows.forEach((row, i) => {
        const icon = row.status === "done" ? sym.check : row.status === "failed" ? sym.cross : row.status === "running" ? frame : sym.ring
        const style: Style =
          row.status === "running" ? { fg: "white", bold: true } : row.status === "pending" ? { fg: "line" } : row.status === "failed" ? { fg: "white", bold: true } : { fg: "text" }
        let col = canvas.text(startX, y + i, icon, row.status === "done" ? S.bright : style)
        col = canvas.text(col + 2, y + i, row.title, style, rowW - 12)
        if (row.detail) canvas.text(col + 1, y + i, row.detail, S.subtle, startX + rowW - 8 - col)
        if (row.time) canvas.text(startX + rowW - width(row.time), y + i, row.time, { fg: "line" })
      })
    },
  }
}

type Segment = [text: string, style: Style]

const segmentsWidth = (segments: Segment[]) => segments.reduce((total, [text]) => total + width(text), 0)

function drawSegments(canvas: Canvas, x: number, y: number, segments: Segment[]) {
  let col = x
  for (const [text, style] of segments) col = canvas.text(col, y, text, style)
}

/** Writes `text` centered in [x, x + w). */
function center(canvas: Canvas, x: number, w: number, y: number, text: string, style: Style) {
  canvas.text(x + Math.max(0, Math.floor((w - width(text)) / 2)), y, text, style)
}

/**
 * ✓ 1 BASE ┈┈ ◆ 2 STACK ┈┈ ○ 3 AUTH … as styled segments: the widest form
 * that fits `maxW`, trying forms 0…`shortest` (0 and 1 name every step, 2
 * numbers them, 3 is just glyphs and the current label). Null if none fit.
 */
function stepSegments(steps: { labels: string[]; current: number }, maxW: number, shortest = 3): Segment[] | null {
  const { labels, current } = steps
  const glyph = (i: number) => (i < current ? sym.check : i === current ? sym.diamond : sym.ring)
  const label = (i: number) => labels[i]!.toUpperCase()
  const variants: Array<{ text: (i: number) => string; dashes: number }> = [
    { text: (i) => `${glyph(i)} ${i + 1} ${label(i)}`, dashes: 2 },
    { text: (i) => `${glyph(i)} ${i + 1} ${label(i)}`, dashes: 1 },
    { text: (i) => (i === current ? `${glyph(i)} ${i + 1} ${label(i)}` : `${glyph(i)} ${i + 1}`), dashes: 1 },
    { text: (i) => (i === current ? `${glyph(i)} ${label(i)}` : glyph(i)), dashes: 0 },
  ]
  for (const variant of variants.slice(0, shortest + 1)) {
    const segments: Segment[] = []
    labels.forEach((_, i) => {
      const style: Style = i < current ? { fg: "muted" } : i === current ? { fg: "white", bold: true } : { fg: "line" }
      if (i) {
        const connector = variant.dashes ? ` ${(unicode ? "┈" : "-").repeat(variant.dashes)} ` : " "
        segments.push([connector, i <= current ? { fg: "subtle" } : { fg: "tint" }])
      }
      segments.push([variant.text(i), style])
    })
    if (segmentsWidth(segments) <= maxW) return segments
  }
  return null
}
