import { Canvas } from "./canvas"
import { drawMark, MARK_HEIGHT, MARK_WIDTH } from "./logo"
import type { Key } from "./term"
import { colorEnabled, depth, hue, type RGB, type Style, sym, truncate, unicode, width, wrap } from "./theme"

/**
 * One full-screen page of the CLI, centered on a softly vignetted background:
 *
 *                                                               ▄█▀█▄
 *             ✓ 1 BASE ┈┈ ◆ 2 STACK ┈┈ ○ 3 AUTH ┈┈ ○ 4 TOOLBOX  ▄▄█▄▄  v0.2.0
 *                                                               ▀███▀
 *
 *                              Pick your engine.
 *                 How the API is built and where the data lives.
 *
 *                 FRAMEWORK · pick one        HTTP SERVER · pick one
 *                 ● NestJS   ○ Plain          ● Express   ○ Fastify
 *
 *                              DATABASE · pick one
 *                     ● PostgreSQL   ○ MySQL   ○ SQLite
 *
 *               ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄
 *          NestJS · Modules, controllers and dependency injection,
 *               with nestjs-zod turning the shared schemas into DTOs.
 *             space snap   ←↑↓→ move   enter next   esc back
 *
 * Chips are plain text: ● / ○ for pick-one groups, ◼ / ◻ for pick-any ones,
 * and a soft highlight under the cursor. Small groups sit side by side in two
 * columns; an odd one out is centered below them. All grays, except red for
 * errors and amber for warnings.
 */

export interface ChipItem {
  id: string
  label: string
  /** Shown in the help panel while highlighted. */
  about?: string
  /** A real color to preview. */
  swatch?: RGB | null
  /** Why it can't be picked. */
  disabled?: string
  /** What you give up while it's switched off — shown as a warning. */
  warning?: string
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
  /** One row with the label beside it and the verdict under it — for pages of several inputs. */
  compact?: boolean
  validate(value: string): { tone: Tone; message: string }
}

export interface SummaryField {
  kind: "summary"
  id: string
  rows: Array<[label: string, value: string, tone?: Tone]>
}

export interface ProgressField {
  kind: "progress"
  id: string
  rows: Array<{ status: "pending" | "running" | "done" | "failed"; title: string; detail?: string; time?: string }>
}

export type Field = ChipField | InputField | SummaryField | ProgressField

export interface Page {
  /** At the top when there are no steps ("klin add · my-app"). */
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
  /**
   * Rows to keep for the page body at a terminal width — the tallest page of a
   * multi-step flow — so every page of it starts on the same row.
   */
  room?: (width: number) => number
}

export type Action = "submit" | "back" | "cancel" | "changed" | "none"

/** Where a chip (or an input box) was drawn, for arrow-key moves. */
interface Placed {
  field: number
  item: number
  x: number
  y: number
  w: number
  /** The grid cell its group sits in, [left, right). */
  cell: [number, number]
  /** Which row of the page layout it's in (side-by-side groups share one). */
  band: number
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
  line: { fg: "line" } satisfies Style,
  subtle: { fg: "subtle" } satisfies Style,
  muted: { fg: "muted" } satisfies Style,
  text: { fg: "text" } satisfies Style,
  bright: { fg: "bright" } satisfies Style,
  heading: { fg: "white", bold: true } satisfies Style,
}

/** Red for errors, amber for warnings, quiet gray when all is well. */
const toneStyle = (tone: Tone | undefined, ok: Style = S.muted): Style =>
  tone === "error" ? { fg: hue.error, bold: true } : tone === "warn" ? { fg: hue.warn, bold: true } : ok

const toneIcon = (tone: Tone) => (tone === "ok" ? sym.check : tone === "warn" ? sym.warn : sym.cross)

/** Widest the page body gets, the gap between two side-by-side groups, and between chips. */
const BODY_MAX = 92
const COLUMN_GAP = 6
const CHIP_GAP = 1

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
    this.enter(Math.max(0, this.page.fields.findIndex(isInteractive)))
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

  /** Puts the cursor on a field: on its picked chip for pick-one groups, else the first. */
  private enter(index: number) {
    const field = this.page.fields[index]
    let item = 0
    if (field?.kind === "chips" && !field.multi) item = Math.max(0, field.items.findIndex((i) => field.isOn(i.id)))
    this.cursor = { field: index, item }
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
      if (key.name === "down") return this.moveRow(1)
      if (key.name === "up") return this.moveRow(-1)
      return this.edit(field, key)
    }
    if (field?.kind === "chips") {
      if (key.name === "left") return this.moveItem(-1)
      if (key.name === "right") return this.moveItem(1)
      if (key.name === "up") return this.moveRow(-1)
      if (key.name === "down") return this.moveRow(1)
      if (key.name === "home") return this.jump(field, 0)
      if (key.name === "end") return this.jump(field, field.items.length - 1)
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
    this.enter(index)
    return "changed"
  }

  private jump(field: ChipField, item: number): Action {
    const next = Math.min(field.items.length - 1, Math.max(0, item))
    if (next === this.cursor.item) return "none"
    this.cursor.item = next
    return "changed"
  }

  private here(): Placed | undefined {
    const { field, item } = this.cursor
    return this.placed.find((p) => p.field === field && p.item === item) ?? this.placed.find((p) => p.field === field)
  }

  /** ←/→: the next chip along this line of the group; past its edge, into the group beside it. */
  private moveItem(step: number): Action {
    const here = this.here()
    if (!here) return "none"
    const along = this.placed.filter((p) => p.field === here.field && p.y === here.y && (step > 0 ? p.x > here.x : p.x < here.x))
    const pool = along.length
      ? along
      : this.placed.filter(
          (p) => p.band === here.band && p.field !== here.field && (step > 0 ? p.cell[0] >= here.cell[1] : p.cell[1] <= here.cell[0])
        )
    // The closest line first, then the chip nearest to where we left.
    const best = pool.sort((a, b) => Math.abs(a.y - here.y) - Math.abs(b.y - here.y) || Math.abs(a.x - here.x) - Math.abs(b.x - here.x))[0]
    if (!best) return "none"
    this.cursor = { field: best.field, item: best.item }
    return "changed"
  }

  /**
   * ↑/↓: the next row of the same group; past its edge, the nearest group
   * above/below in the same column (or spanning it), else the next group.
   */
  private moveRow(step: number): Action {
    const here = this.here()
    if (!here) return this.moveField(step)
    const ahead = (p: Placed) => (step > 0 ? p.y > here.y : p.y < here.y)
    const overlaps = (p: Placed) => p.cell[0] < here.cell[1] && here.cell[0] < p.cell[1]
    let pool = this.placed.filter((p) => p.field === here.field && ahead(p))
    if (!pool.length) pool = this.placed.filter((p) => p.field !== here.field && ahead(p) && overlaps(p))
    // Nothing in this column that way: on to the next group, as tab would.
    if (!pool.length) return this.moveField(step)
    const dy = Math.min(...pool.map((p) => Math.abs(p.y - here.y)))
    pool = pool.filter((p) => Math.abs(p.y - here.y) === dy)
    // Out of an input box: into the first group of that row, the way tab goes.
    if (this.focused?.kind === "input") {
      this.enter(Math.min(...pool.map((p) => p.field)))
      return "changed"
    }
    const center = here.x + here.w / 2
    const best = pool.sort((a, b) => Math.abs(a.x + a.w / 2 - center) - Math.abs(b.x + b.w / 2 - center))[0]!
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

    const top = this.topLine(canvas, w, h)
    const bottom = this.footer(canvas, w, h)
    const avail = bottom - top

    const bodyW = Math.min(w - 4, BODY_MAX)
    const left = Math.floor((w - bodyW) / 2)
    const blocks = this.layout(bodyW)
    const height = sum(blocks)

    // The page is centered under the steps, placed where the flow's tallest
    // page would start, so it doesn't jump from step to step.
    if (height <= avail) {
      this.scroll = 0
      const tallest = Math.min(avail, Math.max(height, this.page.room?.(w) ?? 0))
      this.drawBlocks(canvas, blocks, left, top + Math.floor((avail - tallest) / 2), bodyW)
      return this.finish(canvas, w, h)
    }

    // Not enough room: the page scrolls under the steps.
    const from = top
    const room = bottom - from
    const [focusTop, focusBottom] = this.focusOffset(blocks)
    if (focusTop - this.scroll < 0) this.scroll = focusTop
    if (focusBottom - this.scroll > room) this.scroll = focusBottom - room
    this.scroll = Math.max(0, Math.min(this.scroll, height - room))
    canvas.clip = { top: from, bottom }
    this.drawBlocks(canvas, blocks, left, from - this.scroll, bodyW)
    canvas.clip = undefined
    // Quiet hints that there's more above or below.
    if (this.scroll > 0) center(canvas, 0, w, from - 1, unicode ? "▴ more" : "^ more", S.line)
    if (height - this.scroll > room) center(canvas, 0, w, bottom, unicode ? "▾ more" : "v more", S.line)
    return this.finish(canvas, w, h)
  }

  private drawBlocks(canvas: Canvas, blocks: Block[], x: number, y: number, w: number) {
    for (const block of blocks) {
      block.draw(canvas, x, y, w)
      y += block.height
    }
  }

  private finish(canvas: Canvas, w: number, h: number) {
    if (this.modal) this.drawModal(canvas, w, h)
    return canvas
  }

  /**
   * The step indicator (or the page title) on its own line at the top, and in
   * the corner the small klin egg with the version beside it. When the steps
   * would run into the egg they move down under it. Returns the first row
   * free below them.
   */
  private topLine(canvas: Canvas, w: number, h: number): number {
    const { steps, title, version } = this.page
    const segments = steps ? (stepSegments(steps, w - 4) ?? []) : title ? ([[truncate(title, w - 4), S.muted]] as Segment[]) : []
    const x = Math.floor((w - segmentsWidth(segments)) / 2)
    const y = h >= 20 ? 1 : 0
    const vx = version ? w - width(version) - 2 : w
    const mx = vx - 2 - MARK_WIDTH
    // The egg spans the top three rows with the version beside its middle one.
    if (version && h >= 16 && mx > 2 && drawMark(canvas, mx, 0)) {
      canvas.text(vx, 1, version, S.line)
      const below = x + segmentsWidth(segments) + 2 >= mx
      const row = below ? MARK_HEIGHT : y
      drawSegments(canvas, x, row, segments)
      return Math.max(row + 2, MARK_HEIGHT + 1)
    }
    drawSegments(canvas, x, y, segments)
    // No room for the egg: just the version, above the steps or beside them if they don't touch.
    if (version && (y > 0 || vx > x + segmentsWidth(segments) + 2)) canvas.text(vx, 0, version, S.line)
    return y + 2
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
    const rows = h >= 30 ? 3 : 2
    const helpTop = h - 2 - rows
    const rule = Math.min(blockW, 64)
    canvas.hline(Math.floor((w - rule) / 2), helpTop - 1, rule, S.line, unicode ? "┄" : "-")
    const content = this.helpContent()
    if (content) {
      const titleStyle = toneStyle(content.tone, { fg: "bright", bold: true })
      // A problem (✖ Use letters…) is colored all the way through; help keeps its text quiet.
      const textStyle: Style = content.notice && content.tone !== "ok" ? { ...toneStyle(content.tone), bold: false } : S.muted
      const paragraph = content.text ? `${content.title}${content.notice ? "" : " ·"} ${content.text}` : content.title
      // Even lines when it all fits; when it doesn't, full ones up to the cut.
      const full = wrap(paragraph, blockW)
      const lines = full.length <= rows ? balanced(paragraph, blockW) : full
      const shown = lines.slice(0, rows)
      if (lines.length > rows) shown[rows - 1] = truncate(`${shown[rows - 1]} …`, blockW)
      shown.forEach((line, i) => {
        const x = Math.floor((w - width(line)) / 2)
        if (i === 0 && line.startsWith(content.title)) {
          const after = canvas.text(x, helpTop, content.title, titleStyle)
          canvas.text(after, helpTop, line.slice(content.title.length), textStyle)
        } else canvas.text(x, helpTop + i, line, textStyle)
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

  private helpContent(): { title: string; text: string; tone?: Tone; notice?: boolean } | undefined {
    if (this.modal) return { title: this.modal.title, text: this.modal.text, tone: "warn" }
    if (this.notice) {
      return { title: toneIcon(this.notice.tone), text: this.notice.text, tone: this.notice.tone, notice: true }
    }
    const field = this.focused
    if (field?.kind === "chips") {
      const item = field.items[this.cursor.item]
      if (item?.disabled) return { title: item.label, text: `${item.disabled}.` }
      if (item?.warning && !field.isOn(item.id)) return { title: `${sym.warn} ${item.label} is off`, text: item.warning, tone: "warn" }
      if (item) return { title: item.label, text: item.about ?? "" }
    }
    if (field?.kind === "input") {
      // A compact input's verdict is cut to its box, so the help line spells a problem out.
      const verdict = field.compact ? field.validate(field.value) : undefined
      if (verdict && verdict.tone !== "ok") return { title: `${toneIcon(verdict.tone)} ${field.label}:`, text: verdict.message, tone: verdict.tone, notice: true }
      return { title: field.label, text: field.about ?? "" }
    }
    if (this.page.help) return this.page.help
    return undefined
  }

  /**
   * The page as a vertical list of blocks: the heading, then the fields with
   * one blank row between them. Chip groups that fit go two to a row.
   */
  private layout(bodyW: number): Block[] {
    const page = this.page
    // A subtitle too long for the body wraps onto a second line rather than being cut.
    const subtitle = page.subtitle ? balanced(page.subtitle, bodyW) : []
    if (subtitle.length > 2) subtitle.splice(1, Infinity, truncate(subtitle.slice(1).join(" "), bodyW))
    const blocks: Block[] = [
      {
        height: 1 + subtitle.length,
        fields: [],
        draw: (c, x, y, w) => {
          center(c, x, w, y, truncate(page.heading, w), S.heading)
          subtitle.forEach((line, i) => center(c, x, w, y + 1 + i, line, S.muted))
        },
      },
    ]
    const fields = page.fields
    // Chip groups that fit go two to a row; every such row on the page shares one pair of columns.
    const pairs = new Map<number, [ChipField, ChipField]>()
    for (let index = 0; index < fields.length; index++) {
      const [a, b] = [fields[index], fields[index + 1]]
      if (a?.kind === "chips" && b?.kind === "chips" && sideBySide(a, b, bodyW)) pairs.set(index++, [a, b])
    }
    const columns = sharedColumns([...pairs.values()], bodyW)
    const compact = (field: Field | undefined) => field?.kind === "input" && !!field.compact
    // Compact inputs line their boxes up behind the widest label.
    const labelW = Math.max(0, ...fields.map((field) => (field.kind === "input" && field.compact ? width(field.label) : 0)))
    for (let index = 0; index < fields.length; index++) {
      const field = fields[index]!
      const band = blocks.length + 1
      // Their verdict row already spaces a run of compact inputs apart.
      if (!(compact(field) && compact(fields[index - 1]))) blocks.push(gap())
      if (field.kind === "input" && field.compact) blocks.push(this.compactInputBlock(field, index, band, labelW))
      else if (field.kind === "chips") {
        const pair = pairs.get(index)
        if (pair) {
          blocks.push(this.chipRow(pair, [index, index + 1], bodyW, band, columns))
          index++
        } else blocks.push(this.chipRow([field], [index], bodyW, band))
      } else if (field.kind === "input") blocks.push(this.inputBlock(field, index, band))
      else if (field.kind === "summary") blocks.push(summaryBlock(field))
      else blocks.push(progressBlock(field))
    }
    return blocks
  }

  /** Rows the page body takes at a terminal width (the heading and fields, not the header or footer). */
  bodyHeight(width: number): number {
    return sum(this.layout(Math.min(width - 4, BODY_MAX)))
  }

  /** Where the focused field sits in the laid-out page: [top, bottom). */
  private focusOffset(blocks: Block[]): [number, number] {
    const index = blocks.findIndex((b) => b.fields.includes(this.cursor.field))
    if (index < 0) return [0, 0]
    const top = sum(blocks.slice(0, index))
    // The first field brings the heading along with it.
    return [index <= 2 ? 0 : top, top + blocks[index]!.height]
  }

  /**
   * One chip group across the body, or two lists side by side — each column
   * just wide enough for its group (or the page's shared `columns`, which keep
   * stacked pairs lined up), the pair centered as one.
   */
  private chipRow(fields: ChipField[], indexes: number[], maxW: number, band: number, columns?: [number, number]): Block {
    const grids = fields.map((field) => gridFor(field.items, maxW))
    const { notes, cells: natural } = rowCells(fields, maxW)
    const aligned = fields.length === 2 && columns !== undefined
    const cells = aligned ? columns : natural
    const heads = fields.map((field, i) => groupHead(field, grids[i]!, cells[i]!, notes, aligned))
    const rowW = cells.reduce((total, cell) => total + cell, 0) + (fields.length - 1) * COLUMN_GAP
    return {
      height: 1 + Math.max(...grids.map((g) => g.rows)),
      fields: indexes,
      draw: (canvas, x, y, w) => {
        let cellX = x + Math.floor((w - rowW) / 2)
        fields.forEach((field, i) => {
          const head = heads[i]!
          const focused = indexes[i] === this.cursor.field
          const after = canvas.text(cellX + head.titleX, y, head.title, focused ? { fg: "text", bold: true } : { fg: "subtle", bold: true })
          // The focused group's note ("· pick one") comes up a step with its title.
          if (head.note) canvas.text(after, y, head.note[0], focused && head.note[1] === S.line ? S.subtle : head.note[1])
          this.drawChips(canvas, field, indexes[i]!, grids[i]!, cellX + head.gridX, y + 1, [cellX, cellX + cells[i]!], band)
          cellX += cells[i]! + COLUMN_GAP
        })
      },
    }
  }

  private drawChips(canvas: Canvas, field: ChipField, index: number, grid: Grid, x: number, y: number, cell: [number, number], band: number) {
    const focused = index === this.cursor.field
    field.items.forEach((item, i) => {
      const at = grid.at(i)
      const cursor = focused && i === this.cursor.item
      drawChip(canvas, x + at.x, y + at.row, at.w, item, field.isOn(item.id), field.multi, cursor)
      this.placed.push({ field: index, item: i, x: x + at.x, y: y + at.row, w: at.w, cell, band })
    })
  }

  private inputBlock(field: InputField, index: number, band: number): Block {
    return {
      height: 5,
      fields: [index],
      draw: (canvas, x, y, w) => {
        const focused = index === this.cursor.field
        const boxW = Math.min(w, 58)
        const bx = x + Math.floor((w - boxW) / 2)
        const result = field.validate(field.value)
        // Label, box and verdict all centered on the same axis.
        const label: Segment[] = [
          [`${sym.diamond} `, focused ? { fg: "white" } : S.subtle],
          [field.label, { fg: focused ? "white" : "text", bold: true }],
          ...(field.hint && width(field.label) + width(field.hint) + 3 <= w ? ([[` ${field.hint}`, S.subtle]] as Segment[]) : []),
        ]
        drawSegments(canvas, x + Math.floor((w - segmentsWidth(label)) / 2), y, label)
        const border: Style = result.tone === "error" ? { fg: hue.error } : focused ? { fg: "muted" } : S.line
        canvas.box(bx, y + 1, boxW, 3, focused || result.tone === "error" ? "solid" : "dashed", border, { bg: "bar" })
        const inner = boxW - 6
        // Keep the caret in view for long values.
        const start = Math.max(0, field.caret - inner + 1)
        const visible = field.value.slice(start, start + inner)
        const col = canvas.text(bx + 2, y + 2, sym.caret, focused ? { fg: "white", bold: true } : S.subtle)
        if (!field.value && field.placeholder) canvas.text(col + 1, y + 2, field.placeholder, S.subtle, inner)
        canvas.text(col + 1, y + 2, visible, { fg: "white", bold: true }, inner)
        if (focused) {
          // The caret sits on the next character — the placeholder's first one while it's empty.
          const under = field.value[field.caret] ?? (field.value ? " " : (field.placeholder?.[0] ?? " "))
          canvas.text(col + 1 + (field.caret - start), y + 2, under, depth >= 256 ? { fg: "bg", bg: "bright" } : { inverse: true })
        }
        center(canvas, x, w, y + 4, truncate(`${toneIcon(result.tone)} ${result.message}`, w), toneStyle(result.tone))
        this.placed.push({ field: index, item: 0, x: bx, y: y + 2, w: boxW, cell: [x, x + w], band })
      },
    }
  }

  /** `Label  › value` on one row, the verdict under the value. */
  private compactInputBlock(field: InputField, index: number, band: number, labelW: number): Block {
    return {
      height: 2,
      fields: [index],
      draw: (canvas, x, y, w) => {
        const focused = index === this.cursor.field
        const result = field.validate(field.value)
        const boxW = Math.max(16, Math.min(w - labelW - 2, 60))
        const rowX = x + Math.max(0, Math.floor((w - labelW - 2 - boxW) / 2))
        const bx = rowX + labelW + 2
        const labelStyle: Style = result.tone === "error" ? { fg: hue.error, bold: true } : focused ? { fg: "white", bold: true } : { fg: "subtle", bold: true }
        canvas.text(rowX + labelW - width(field.label), y, field.label, labelStyle)
        canvas.fill(bx, y, boxW, 1, { bg: "bar" })
        const inner = boxW - 4
        // Keep the caret in view for long values.
        const start = Math.max(0, field.caret - inner + 1)
        const col = canvas.text(bx + 1, y, sym.caret, focused ? { fg: "white", bold: true } : S.subtle)
        if (!field.value && field.placeholder) canvas.text(col + 1, y, field.placeholder, S.subtle, inner)
        canvas.text(col + 1, y, field.value.slice(start, start + inner), focused ? { fg: "white", bold: true } : S.text, inner)
        if (focused) {
          const under = field.value[field.caret] ?? (field.value ? " " : (field.placeholder?.[0] ?? " "))
          canvas.text(col + 1 + (field.caret - start), y, under, depth >= 256 ? { fg: "bg", bg: "bright" } : { inverse: true })
        }
        canvas.text(bx + 1, y + 1, truncate(`${toneIcon(result.tone)} ${result.message}`, boxW - 1), toneStyle(result.tone))
        this.placed.push({ field: index, item: 0, x: bx, y, w: boxW, cell: [x, x + w], band })
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
    canvas.box(x, y, boxW, boxH, "heavy", { fg: hue.warn }, { bg: "bar" })
    canvas.text(x + 3, y + 1, `${sym.warn} ${modal.title}`, toneStyle("warn"), boxW - 6)
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
  /** The fields drawn in it, for scrolling the focused one into view. */
  fields: number[]
  draw(canvas: Canvas, x: number, y: number, w: number): void
}

const sum = (blocks: Block[]) => blocks.reduce((total, block) => total + block.height, 0)
const gap = (): Block => ({ height: 1, fields: [], draw: () => {} })

/* ─── Chips ───────────────────────────────────────────────────────────── */

/** ` ● Label ` — a column of padding on each side carries the cursor's highlight. */
const chipWidth = (item: ChipItem) => 3 + (item.swatch ? 2 : 0) + width(item.label) + 1

interface Grid {
  /** One chip per line (else a grid). */
  list: boolean
  rows: number
  width: number
  at(i: number): { x: number; row: number; w: number }
}

/** Groups up to this long are a single column; longer ones (18 theme colors) become a grid. */
const LIST_MAX = 8

/**
 * Lays chips out: one per line for short groups; long ones in an even grid
 * of equal columns, as many as fit `maxW`.
 */
function gridFor(items: ChipItem[], maxW: number): Grid {
  const colW = Math.min(maxW, Math.max(...items.map(chipWidth)))
  if (items.length <= LIST_MAX) return { list: true, rows: items.length, width: colW, at: (i) => ({ x: 0, row: i, w: colW }) }
  const fit = Math.max(1, Math.floor((maxW + CHIP_GAP) / (colW + CHIP_GAP)))
  const rows = Math.ceil(items.length / fit)
  // Balance the rows: 18 chips in 7 columns become 6 × 3, not 7 + 7 + 4.
  const cols = Math.ceil(items.length / rows)
  return {
    list: false,
    rows,
    width: cols * colW + (cols - 1) * CHIP_GAP,
    at: (i) => ({ x: (i % cols) * (colW + CHIP_GAP), row: Math.floor(i / cols), w: colW }),
  }
}

/** Columns two groups need side by side (with or without their notes). */
function pairWidth(a: ChipField, b: ChipField, maxW: number, notes: boolean) {
  const blockW = (field: ChipField) => groupHead(field, gridFor(field.items, maxW), maxW, notes).blockW
  return blockW(a) + COLUMN_GAP + blockW(b)
}

/** Two lists share a row when they fit side by side — notes or not. */
function sideBySide(a: ChipField, b: ChipField, maxW: number) {
  return gridFor(a.items, maxW).list && gridFor(b.items, maxW).list && pairWidth(a, b, maxW, false) <= maxW
}

/** A row's cell widths, and whether its notes fit (if not, they go; warnings stay). */
function rowCells(fields: ChipField[], maxW: number) {
  if (fields.length === 1) return { notes: true, cells: [maxW] }
  const notes = pairWidth(fields[0]!, fields[1]!, maxW, true) <= maxW
  return { notes, cells: fields.map((field) => groupHead(field, gridFor(field.items, maxW), maxW, notes).blockW) }
}

/** One pair of column widths for every side-by-side row on a page, when there are several and they fit. */
function sharedColumns(pairs: Array<[ChipField, ChipField]>, maxW: number): [number, number] | undefined {
  if (pairs.length < 2) return undefined
  const cells = pairs.map((pair) => rowCells(pair, maxW).cells)
  const columns: [number, number] = [Math.max(...cells.map((c) => c[0]!)), Math.max(...cells.map((c) => c[1]!))]
  return columns[0] + COLUMN_GAP + columns[1] <= maxW ? columns : undefined
}

/**
 * A group's title line, laid out in a cell `w` wide, with a note ("· pick
 * one") trailing it: a list's title heads its column, a grid's is centered
 * over it. When parts that carry a warning are switched off, the note becomes
 * an amber "▲ CORS is off" (shown even when `notes` is false). `start` keeps
 * the group at the cell's left edge, for columns shared with the rows around it.
 */
function groupHead(field: ChipField, grid: Grid, w: number, notes: boolean, start = false) {
  const title = truncate(field.title.toUpperCase(), w)
  const off = field.items.filter((item) => item.warning && !field.isOn(item.id))
  const note: Segment | undefined = off.length
    ? [`  ${sym.warn} ${off.length === 1 ? `${off[0]!.label} is` : `${off.length} are`} off`, { fg: hue.warn }]
    : notes && field.note
      ? [`  ${sym.dot} ${field.note}`, S.line]
      : undefined
  const lineW = width(title) + (note ? width(note[0]) : 0)
  const blockW = Math.max(grid.width, lineW)
  const left = start ? 0 : Math.max(0, Math.floor((w - blockW) / 2))
  // A list's chips start one column in (the cursor's padding), so the title lines up with the glyphs.
  const indent = grid.list ? 1 : 0
  return {
    title,
    note: note && lineW <= w ? note : undefined,
    titleX: grid.list ? left + indent : left + Math.floor((blockW - lineW) / 2),
    gridX: grid.list ? left : left + Math.floor((blockW - grid.width) / 2),
    blockW: blockW + indent,
  }
}

function drawChip(canvas: Canvas, x: number, y: number, w: number, item: ChipItem, on: boolean, multi: boolean, cursor: boolean) {
  const glyph = multi ? (on ? (unicode ? "◼" : "x") : unicode ? "◻" : "-") : on ? (unicode ? "●" : "*") : unicode ? "○" : "o"
  const disabled = Boolean(item.disabled)
  const warned = Boolean(item.warning) && !on
  let label: Style = disabled ? { fg: "line", strike: true } : on ? { fg: "bright", bold: true } : { fg: "muted" }
  let mark: Style = disabled ? { fg: "line" } : warned ? { fg: hue.warn } : on ? { fg: "white", bold: true } : { fg: "subtle" }
  if (cursor) {
    // The highlight: a soft lifted bar where there's a background to paint, inverse where there isn't.
    const bar: Style = depth >= 256 ? { bg: "lift" } : { inverse: true }
    canvas.fill(x, y, w, 1, bar)
    label = { ...label, ...bar, fg: disabled ? "subtle" : "white" }
    mark = { ...mark, ...bar, ...(warned || disabled ? {} : { fg: "white" }) }
    if (!colorEnabled) canvas.text(x, y, sym.caret, {})
  }
  let col = canvas.text(x + 1, y, glyph, mark) + 1
  if (item.swatch) col = canvas.text(col, y, colorEnabled && depth >= 256 ? "■" : sym.block, depth >= 256 ? { fg: item.swatch } : S.bright) + 1
  canvas.text(col, y, item.label, label, x + w - 1 - col)
}

/* ─── Summary and progress ────────────────────────────────────────────── */

function summaryBlock(field: SummaryField): Block {
  // Long values wrap onto extra lines instead of being cut off.
  const layoutRows = (w: number) => {
    const labelW = Math.max(...field.rows.map(([label]) => width(label)))
    const valueW = Math.max(12, Math.min(w - labelW - 3, 60))
    const lines = field.rows.flatMap(([label, value, tone]) => {
      // A flagged row is colored from its ▲ on ("Helmet · ▲ CORS off"), or all through without one.
      let flag = tone && tone !== "ok" ? Math.max(0, value.indexOf(sym.warn)) : Infinity
      return wrap(value, valueW).map((part, i) => {
        const line = [i ? "" : label, part, tone, Math.min(flag, part.length)] as const
        flag = Math.max(0, flag - part.length - 1)
        return line
      })
    })
    const blockW = labelW + 3 + Math.max(...lines.map(([, part]) => width(part)))
    return { labelW, lines, blockW }
  }
  return {
    height: layoutRows(BODY_MAX).lines.length,
    fields: [],
    draw: (canvas, x, y, w) => {
      const { labelW, lines, blockW } = layoutRows(w)
      const startX = x + Math.max(0, Math.floor((w - blockW) / 2))
      lines.forEach(([label, value, tone, flag], i) => {
        canvas.text(startX + labelW - width(label), y + i, label, S.subtle)
        const col = canvas.text(startX + labelW + 3, y + i, value.slice(0, flag), S.bright)
        if (tone && tone !== "ok") canvas.text(col, y + i, value.slice(flag), { ...toneStyle(tone), bold: false })
      })
    },
  }
}

const SPIN = unicode ? ["◐", "◓", "◑", "◒"] : ["-", "\\", "|", "/"]

function progressBlock(field: ProgressField): Block {
  return {
    height: field.rows.length,
    fields: [],
    draw: (canvas, x, y, w) => {
      const rowW = Math.min(w, 70)
      const startX = x + Math.floor((w - rowW) / 2)
      const frame = SPIN[Math.floor(Date.now() / 120) % SPIN.length]!
      field.rows.forEach((row, i) => {
        const icon = row.status === "done" ? sym.check : row.status === "failed" ? sym.cross : row.status === "running" ? frame : sym.ring
        const style: Style =
          row.status === "running"
            ? { fg: "white", bold: true }
            : row.status === "pending"
              ? { fg: "line" }
              : row.status === "failed"
                ? toneStyle("error")
                : { fg: "text" }
        let col = canvas.text(startX, y + i, icon, row.status === "done" ? S.bright : style)
        col = canvas.text(col + 2, y + i, row.title, style, rowW - 12)
        if (row.detail) canvas.text(col + 1, y + i, row.detail, S.subtle, startX + rowW - 8 - col)
        if (row.time) canvas.text(startX + rowW - width(row.time), y + i, row.time, { fg: "line" })
      })
    },
  }
}

/* ─── Text helpers ────────────────────────────────────────────────────── */

type Segment = [text: string, style: Style]

const segmentsWidth = (segments: Segment[]) => segments.reduce((total, [text]) => total + width(text), 0)

function drawSegments(canvas: Canvas, x: number, y: number, segments: Segment[]) {
  let col = x
  for (const [text, style] of segments) col = canvas.text(col, y, text, style)
}

/** Wraps `text` to `max` columns with its lines as even as they go, so a last line isn't one lone word. */
function balanced(text: string, max: number): string[] {
  const count = wrap(text, max).length
  if (count < 2) return wrap(text, max)
  let w = max
  while (w > 1 && wrap(text, w - 1).length === count) w--
  return wrap(text, w)
}

/** Writes `text` centered in [x, x + w). */
function center(canvas: Canvas, x: number, w: number, y: number, text: string, style: Style) {
  canvas.text(x + Math.max(0, Math.floor((w - width(text)) / 2)), y, text, style)
}

/**
 * ✓ 1 BASE ┈┈ ◆ 2 STACK ┈┈ ○ 3 AUTH … as styled segments: the widest form
 * that fits `maxW` (0 and 1 name every step, 2 numbers them, 3 is just glyphs
 * and the current label). Null if none fit.
 */
function stepSegments(steps: { labels: string[]; current: number }, maxW: number): Segment[] | null {
  const { labels, current } = steps
  const glyph = (i: number) => (i < current ? sym.check : i === current ? sym.diamond : sym.ring)
  const label = (i: number) => labels[i]!.toUpperCase()
  const variants: Array<{ text: (i: number) => string; dashes: number }> = [
    { text: (i) => `${glyph(i)} ${i + 1} ${label(i)}`, dashes: 2 },
    { text: (i) => `${glyph(i)} ${i + 1} ${label(i)}`, dashes: 1 },
    { text: (i) => (i === current ? `${glyph(i)} ${i + 1} ${label(i)}` : `${glyph(i)} ${i + 1}`), dashes: 1 },
    { text: (i) => (i === current ? `${glyph(i)} ${label(i)}` : glyph(i)), dashes: 0 },
  ]
  for (const variant of variants) {
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
