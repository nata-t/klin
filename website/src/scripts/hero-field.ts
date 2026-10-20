import { LID_CLOSED, logoShade } from "@cli/ui/logo"
import { heroLogo } from "../lib/hero-logo"
import { drawGeometric, FONT_STACK } from "../wizard/glyphs"
import { BEATS, intro } from "./intro"

/**
 * The hero: klin hatches.
 *
 * The cells come from the CLI's own pixel art (../lib/hero-logo.ts takes it
 * apart): the egg — its cap and its shell — and the "klin" letters, in the
 * same chrome gradient as the wizard's header. The opening (timed by
 * ./intro.ts) types the create command, collapses the line like a CRT
 * switching over, then drops the egg in: it lands with a flash, a jolt, crop
 * marks and a burst of sparks. The egg wobbles, cracks and pops its cap
 * away; the shell breaks up and its pixels fly out as the letters, which land
 * one after another. Then the chrome pours in top-down and the CLI's band of
 * light sweeps across, and only the word is left.
 *
 * Settled, every cell of the word lives on its own spring: the cursor nudges
 * cells aside and lights them, scrolling away lets them drift apart, and a
 * click folds the word back into the egg and hatches it again.
 */

interface Cell {
  col: number
  row: number
  glyph: string
  kind: "cap" | "shell" | "word"
  shade: number
  /** Where the band of light reaches it, 0..1 across the logo (the CLI's sweep). */
  at: number
  /** Which part it belongs to: 0 the egg, then 1–4 for k, l, i, n. */
  part: number
  /** A letter's cell: the spot inside the egg it hatches from, and how late it leaves. */
  from: { col: number; row: number }
  delay: number
  x: number
  y: number
  vx: number
  vy: number
  spread: [number, number]
}

interface Part {
  cells: Cell[]
  box: { c0: number; c1: number; r0: number; r1: number }
  snapped: boolean
  snapAt: number
}

interface Spark {
  x: number
  y: number
  vx: number
  vy: number
  born: number
  life: number
  glyph: string
  /** Bits of shell fall; landing sparks drift to a stop. */
  gravity?: boolean
}

interface Mote {
  x: number
  y: number
  vx: number
  vy: number
  text: string
  alpha: number
  size: number
  depth: number
}

const ROW_RATIO = 2.05
const COMMAND = "npm create klin@latest"
const DUST = "{}[]()<>;:=+*/|&!?#@$%~^.,_01xz".split("")
const TOKENS = ["z.object()", "createZodDto", "@Public()", "useAppForm", "prisma", "klin:if", "→", "✓", "z.infer", "betterAuth", "queryOptions", "@repo/validators", "turbo dev", "pnpm", "bun", "klin:only", "// TODO", "export", "import", "<Route />"]
const SPARK_GLYPHS = ["+", "·", "×", "·"]
const SHELL_GLYPHS = ["▘", "▝", "▖", "▗", "·"]

/*
 * The sequence, in seconds from the egg's launch (`s`): the drop and its
 * landing, the hatch, then the letters. The beats in ./intro.ts place it.
 */
const FLIGHT = 0.6
/** The fraction of the drop at which the egg lands (the rest is recoil). */
const IMPACT = 0.5
const HATCH = BEATS.hatch - BEATS.egg
const WOBBLE = 0.45
const CRACK = 0.1
const POP = 0.45
const WORD = BEATS.word - BEATS.egg
const SHELL_FADE = 0.3
/** Each letter leaves a little after the last; its cells straggle by up to JITTER. */
const LETTER_GAP = 0.08
const JITTER = 0.07
const TRAVEL = 0.6
const SEQ_END = WORD + 3 * LETTER_GAP + JITTER + TRAVEL + 0.05
/** Click replay: the word folds back into the egg, which sits for a moment before it hatches again. */
const COLLAPSE = 0.55
const SEATED = 0.15

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const pad = (n: number, width: number) => String(Math.round(Math.max(0, n))).padStart(width, "0")
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInCubic = (t: number) => t * t * t
const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2

/**
 * How far the egg still is from its place during the drop: 1 at the start,
 * 0 in place. It accelerates in; after impact a small damped recoil.
 */
function flight(local: number) {
  if (local <= 0) return 1
  if (local < IMPACT) return 1 - easeInOutCubic(local / IMPACT)
  const k = (local - IMPACT) / (1 - IMPACT)
  if (k >= 1) return 0
  return -0.035 * Math.sin(Math.PI * k * 1.5) * Math.exp(-4 * k)
}

/**
 * The egg `t` seconds into its hatch: `lid` is how many pixels lower than at
 * rest the cap sits (negative: higher), `tilt` the egg's rock, `capTilt` the
 * cap's own turn and `capAlpha` how much of it is left as it flies off.
 */
function hatchPose(t: number) {
  const closed = LID_CLOSED[20]
  if (t < 0) return { lid: closed, tilt: 0, capTilt: 0, capAlpha: 1 }
  if (t < WOBBLE) {
    const k = t / WOBBLE
    return { lid: closed, tilt: 0.085 * Math.sin(k * Math.PI * 4) * (1 - k * 0.6), capTilt: 0, capAlpha: 1 }
  }
  if (t < WOBBLE + CRACK) {
    // The crack opens: the cap lifts a pixel, the egg gives one last shiver.
    const k = (t - WOBBLE) / CRACK
    return { lid: closed - easeOutCubic(k), tilt: 0.03 * Math.sin(k * Math.PI * 2), capTilt: 0, capAlpha: 1 }
  }
  // The cap pops off: up, turning, and gone.
  const u = clamp((t - WOBBLE - CRACK) / POP)
  return { lid: closed - 1 - 18 * easeOutCubic(u), tilt: 0, capTilt: -0.6 * u, capAlpha: 1 - easeInCubic(u) }
}

function heroCells() {
  const art = heroLogo()
  const base = (c: { col: number; row: number; ch: string; part: number }, kind: Cell["kind"]): Cell => ({
    col: c.col,
    row: c.row,
    glyph: c.ch,
    kind,
    shade: logoShade(kind, c.row, art.rows),
    at: (c.col + c.row * 2) / (art.columns + art.rows * 2),
    part: c.part,
    from: { col: c.col, row: c.row },
    delay: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spread: [rand(-1, 1), rand(-1, 1)],
  })
  const egg = art.egg.map((c) => base(c, c.kind === "cap" ? "cap" : "shell"))
  const shell = egg.filter((c) => c.kind === "shell")
  // Every letter's cell hatches from somewhere inside the shell.
  const word = art.word.map((c) => {
    const cell = base(c, "word")
    const at = pick(shell)
    cell.from = { col: at.col, row: at.row }
    cell.delay = rand(0, JITTER)
    return cell
  })
  const partOf = (cells: Cell[]): Part => ({
    cells,
    box: {
      c0: Math.min(...cells.map((c) => c.col)),
      c1: Math.max(...cells.map((c) => c.col)) + 1,
      r0: Math.min(...cells.map((c) => c.row)),
      r1: Math.max(...cells.map((c) => c.row)) + 1,
    },
    snapped: false,
    snapAt: -1,
  })
  const parts = [partOf(egg), ...[1, 2, 3, 4].map((i) => partOf(word.filter((c) => c.part === i)))]
  const shellTop = Math.min(...shell.map((c) => c.row))
  return { columns: art.columns, rows: art.rows, egg, word, parts, shellTop }
}

export function mountHeroField(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>("canvas.field")!
  const slot = hero.querySelector<HTMLElement>("[data-logo-slot]")!
  const countLabel = hero.querySelector<HTMLElement>("[data-hero-count]")
  const pointerLabel = hero.querySelector<HTMLElement>("[data-hero-pointer]")
  const maybe = canvas.getContext("2d")
  if (!maybe) return
  const ctx: CanvasRenderingContext2D = maybe
  hero.dataset.field = "on"

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const { columns, rows, egg, word, parts, shellTop } = heroCells()
  const eggPart = parts[0]!

  let width = 0
  let height = 0
  let dpr = 1
  let cw = 10
  let rh = 20
  let ox = 0
  let oy = 0
  let motes: Mote[] = []
  const sparks: Spark[] = []

  const pointer = { x: -9999, y: -9999, active: false }
  let visible = true
  let scroll = 0
  /** "sequence" while the egg drops and hatches (the opening, or a click replay); "cells" once the word is on its springs. */
  let mode: "sequence" | "cells" = "sequence"
  let replayAt = -1
  let snappedCount = 0
  /** Which hatch moments have shed their bits of shell, so each sheds once a run. */
  const shed = { crack: false, shell: false }

  function layout() {
    const rect = hero.getBoundingClientRect()
    const s = slot.getBoundingClientRect()
    width = rect.width
    height = rect.height
    dpr = Math.min(2, window.devicePixelRatio || 1)
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    cw = s.width / columns
    rh = cw * ROW_RATIO
    ox = s.left - rect.left + (s.width - cw * columns) / 2
    oy = s.top - rect.top + (s.height - rh * rows) / 2
    const count = Math.round(clamp((width * height) / 11000, 40, 130))
    motes = Array.from({ length: count }, () => {
      const isWord = Math.random() < 0.22
      const depth = rand(0.3, 1)
      return {
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(0.02, 0.12) * depth,
        vy: -rand(0.04, 0.16) * depth,
        text: isWord ? pick(TOKENS) : pick(DUST),
        alpha: isWord ? rand(0.1, 0.22) : rand(0.12, 0.38),
        size: isWord ? 11 : rand(10, 14) * depth,
        depth,
      }
    })
    if (mode === "cells") toTargets()
  }

  /** Where a grid spot is on screen right now (it rises a little as the hero scrolls away). */
  const spot = (col: number, row: number) => ({ x: ox + col * cw, y: oy + row * rh - scroll * height * 0.18 })

  /** A letter cell's resting place, drifting apart as the hero scrolls away. */
  const target = (c: Cell) => {
    const drift = scroll * scroll
    return {
      x: ox + c.col * cw + c.spread[0] * drift * width * 0.35,
      y: oy + c.row * rh - scroll * height * 0.18 + c.spread[1] * drift * height * 0.25,
    }
  }

  function toTargets() {
    for (const c of word) {
      const t = target(c)
      c.x = t.x
      c.y = t.y
      c.vx = 0
      c.vy = 0
    }
  }

  const gray = (shade: number, alpha = 1) => `rgba(${shade},${shade},${shade},${alpha})`

  function drawCell(c: Cell, x: number, y: number, shade: number, alpha: number) {
    if (alpha <= 0.002) return
    const color = gray(Math.round(clamp(shade, 0, 255)), alpha)
    if (!drawGeometric(ctx, c.glyph, x, y, cw + 0.35, rh + 0.35, color, 1)) {
      ctx.font = `400 ${cw * 1.45}px ${FONT_STACK}`
      ctx.fillStyle = color
      ctx.textAlign = "center"
      ctx.fillText(c.glyph, x + cw / 2, y + rh / 2)
      ctx.textAlign = "left"
    }
  }

  /* ─── Looks over time ─────────────────────────────────────────────── */

  /** A cell's shade: flat until the chrome pours in top-down and the band sweeps; lit by the cursor and by landings. */
  function faceShade(c: Cell, now: number) {
    const pour = clamp((intro.t - BEATS.chrome - c.row * 0.05) / 0.3)
    let shade = 0xb4 + (c.shade - 0xb4) * easeOutCubic(pour)
    const band = (intro.t - BEATS.chrome - 0.16) / 0.8
    if (band > 0 && band < 1) {
      const at = -0.3 + band * 1.6
      shade += (0xff - shade) * Math.max(0, 1 - Math.abs(c.at - at) * 6)
    }
    if (pointer.active && mode === "cells") {
      const d = Math.hypot(c.x + cw / 2 - pointer.x, c.y + rh / 2 - pointer.y)
      shade += (0xff - shade) * clamp(1 - d / 160) * 0.8
    }
    const part = parts[c.part]
    if (part && part.snapAt > 0) {
      const flash = 1 - (now - part.snapAt) / 110
      if (flash > 0) shade += (0xff - shade) * flash
    }
    return shade
  }

  /* ─── Landings ────────────────────────────────────────────────────── */

  function landed(i: number, now: number, burst: number) {
    const part = parts[i]!
    part.snapped = true
    part.snapAt = now
    if (i > 0) snappedCount = Math.min(4, snappedCount + 1)
    const a = spot(part.box.c0, part.box.r0)
    const b = spot(part.box.c1, part.box.r1)
    for (let n = 0; n < burst; n++) {
      // Sparks leave from the part's outline, outward.
      const side = n % 4
      const x = side === 0 ? a.x : side === 1 ? b.x : rand(a.x, b.x)
      const y = side === 2 ? a.y : side === 3 ? b.y : rand(a.y, b.y)
      const cx = (a.x + b.x) / 2
      const cy = (a.y + b.y) / 2
      const d = Math.hypot(x - cx, y - cy) || 1
      const speed = rand(140, 320)
      sparks.push({ x, y, vx: ((x - cx) / d) * speed, vy: ((y - cy) / d) * speed, born: now, life: rand(380, 620), glyph: pick(SPARK_GLYPHS) })
    }
  }

  /** Crop marks closing on a part as it lands, the instrument's way of saying "registered". */
  function drawCropMarks(part: Part, now: number) {
    const age = (now - part.snapAt) / 460
    if (part.snapAt < 0 || age >= 1) return
    const grow = 1 + 0.4 * (1 - easeOutCubic(clamp(age * 1.6)))
    const a = spot(part.box.c0, part.box.r0)
    const b = spot(part.box.c1, part.box.r1)
    const cx = (a.x + b.x) / 2
    const cy = (a.y + b.y) / 2
    const hw = ((b.x - a.x) / 2 + 8) * grow
    const hh = ((b.y - a.y) / 2 + 8) * grow
    const arm = Math.min(14, hw * 0.5)
    ctx.strokeStyle = `rgba(238,238,238,${(1 - age) ** 0.8})`
    ctx.lineWidth = 1
    ctx.beginPath()
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
      const x = cx + sx * hw
      const y = cy + sy * hh
      ctx.moveTo(x - sx * arm, y)
      ctx.lineTo(x, y)
      ctx.lineTo(x, y - sy * arm)
    }
    ctx.stroke()
  }

  /* ─── The egg ─────────────────────────────────────────────────────── */

  const eggBox = eggPart.box

  /** Bits of shell: a few from along the crack as it opens, a burst from the whole shell as it breaks. */
  function shedShell(now: number, count: number, speed: number, whole: boolean) {
    const a = spot(eggBox.c0, whole ? shellTop : shellTop - 0.4)
    const b = spot(eggBox.c1, whole ? eggBox.r1 : shellTop + 0.2)
    const cx = (a.x + b.x) / 2
    const half = (b.x - a.x) / 2
    for (let n = 0; n < count; n++) {
      const x = rand(a.x, b.x)
      const y = rand(a.y, b.y)
      const out = (x - cx) / half
      sparks.push({ x, y, vx: out * speed * rand(0.4, 1), vy: -speed * rand(0.4, 1.1), born: now, life: rand(520, 900), glyph: pick(SHELL_GLYPHS), gravity: true })
    }
  }

  /**
   * Draws the egg `s` seconds into the sequence: dropping in (with a motion
   * trail), landing, hatching, then breaking away. `fade` scales it all (the
   * replay fades it in as the word folds back).
   */
  function drawEgg(s: number, now: number, fade = 1) {
    if (s < 0) return
    if (!eggPart.snapped && s >= FLIGHT * IMPACT && s < FLIGHT) landed(0, now, 9)
    const t = s - HATCH
    if (t >= WOBBLE && t < WOBBLE + CRACK + POP && !shed.crack) {
      shed.crack = true
      shedShell(now, 5, 90, false)
    }
    if (s >= WORD && s < SEQ_END && !shed.shell) {
      shed.shell = true
      shedShell(now, 18, 230, true)
    }
    const pose = hatchPose(t)
    const breakK = clamp((s - WORD + 0.02) / SHELL_FADE)
    const shellAlpha = fade * (1 - easeInCubic(breakK))
    const capAlpha = fade * pose.capAlpha
    if (shellAlpha <= 0 && capAlpha <= 0) return

    const center = spot((eggBox.c0 + eggBox.c1) / 2, (eggBox.r0 + eggBox.r1) / 2)
    const bottom = spot((eggBox.c0 + eggBox.c1) / 2, eggBox.r1)
    const crack = spot((eggBox.c0 + eggBox.c1) / 2, shellTop)
    const paint = (q: number, alpha: number, ghost: boolean) => {
      ctx.save()
      // The drop: from above, a little turned and bigger.
      ctx.translate(center.x, center.y - height * 0.55 * q)
      ctx.rotate((-10 * Math.PI * q) / 180)
      ctx.scale(1 + 0.3 * Math.max(q, 0), 1 + 0.3 * Math.max(q, 0))
      ctx.translate(-center.x, -center.y)
      // The rock, from the bottom of the egg.
      ctx.translate(bottom.x, bottom.y)
      ctx.rotate(pose.tilt)
      ctx.translate(-bottom.x, -bottom.y)
      for (const c of egg) {
        if (c.kind !== "shell") continue
        const at = spot(c.col, c.row)
        // Breaking, the shell's cells drift out from the middle as they fade.
        const dx = (at.x - center.x) * breakK * 0.35
        const dy = (at.y - center.y) * breakK * 0.35 + breakK * rh * 0.6
        drawCell(c, at.x + dx, at.y + dy, ghost ? 0x90 : faceShade(c, now), alpha * shellAlpha)
      }
      ctx.translate(crack.x, crack.y + (pose.lid * rh) / 2)
      ctx.rotate(pose.capTilt)
      ctx.translate(-crack.x, -crack.y)
      for (const c of egg) {
        if (c.kind !== "cap") continue
        const at = spot(c.col, c.row)
        drawCell(c, at.x, at.y, ghost ? 0x90 : faceShade(c, now), alpha * capAlpha)
      }
      ctx.restore()
    }
    // Only the opening drops it; a replay's egg is already sitting there.
    const q = s < FLIGHT && replayAt < 0 ? flight(s / FLIGHT) : 0
    // Motion trail: the egg a few moments ago, fainter the further back.
    if (q > 0.02) {
      for (let k = 7; k >= 1; k--) {
        const past = flight((s - k * 0.011) / FLIGHT)
        if (past > q) paint(past, 0.1 * (1 - k / 8), true)
      }
    }
    paint(q, 1, false)
  }

  /* ─── The word ────────────────────────────────────────────────────── */

  /** The letters hatching: each cell flies from its spot in the egg to its place, rising as it leaves. */
  function drawWord(s: number, now: number) {
    for (let i = 1; i <= 4; i++) {
      const lands = WORD + (i - 1) * LETTER_GAP + JITTER + TRAVEL * 0.55
      if (!parts[i]!.snapped && s >= lands && s < SEQ_END) landed(i, now, 6)
    }
    for (const c of word) {
      const k = (s - WORD - (c.part - 1) * LETTER_GAP - c.delay) / TRAVEL
      if (k <= 0) continue
      const e = easeOutBack(clamp(k))
      const from = spot(c.from.col, c.from.row)
      const to = spot(c.col, c.row)
      const x = lerp(from.x, to.x, e)
      const y = lerp(from.y, to.y, e) - Math.sin(Math.PI * clamp(k)) * rh * 1.4
      drawCell(c, x, y, faceShade(c, now), clamp(k * 4))
    }
  }

  /** A click replay's first moments: the letters fold back into the egg as it fades in, closed. */
  function drawCollapse(r: number, now: number) {
    const k = clamp(r / COLLAPSE)
    const e = easeInCubic(k)
    for (const c of word) {
      const from = spot(c.from.col, c.from.row)
      drawCell(c, lerp(c.x, from.x, e), lerp(c.y, from.y, e), faceShade(c, now), 1 - clamp((k - 0.55) / 0.45))
    }
    drawEgg(HATCH - SEATED, now, clamp((k - 0.35) / 0.65))
  }

  /* ─── The command, before anything else ───────────────────────────── */

  function drawPrompt(now: number) {
    const t = intro.t
    if (t >= BEATS.egg + 0.2) return
    const size = clamp(cw * 1.45, 16, 27)
    ctx.font = `500 ${size}px ${FONT_STACK}`
    ctx.textBaseline = "middle"
    const typed = COMMAND.slice(0, clamp(Math.floor((t - BEATS.type) / 0.034), 0, COMMAND.length))
    const prompt = "$ "
    const full = ctx.measureText(prompt + COMMAND).width
    const cx = ox + (columns * cw) / 2
    const cy = oy + (rows * rh) / 2
    const x = cx - full / 2

    if (t < BEATS.enter) {
      ctx.fillStyle = gray(0x6a)
      ctx.fillText(prompt, x, cy)
      const px = x + ctx.measureText(prompt).width
      ctx.fillStyle = gray(0xee)
      ctx.fillText(typed, px, cy)
      const typing = typed.length < COMMAND.length && t > BEATS.type
      if (typing || Math.floor(now / 530) % 2 === 0) {
        ctx.fillStyle = gray(0xee)
        ctx.fillRect(px + ctx.measureText(typed).width + 2, cy - size * 0.55, size * 0.55, size * 1.1)
      }
      return
    }
    // Enter: the line folds into a bright seam that widens, then pinches out — a CRT switching over.
    const fold = clamp((t - BEATS.enter) / 0.12)
    const pinch = clamp((t - BEATS.enter - 0.12) / 0.26)
    if (fold < 1) {
      ctx.save()
      ctx.translate(0, cy)
      ctx.scale(1, 1 - fold)
      ctx.fillStyle = gray(0xff, 1 - fold * 0.3)
      ctx.fillText(prompt + COMMAND, x, 0)
      ctx.restore()
    }
    const seam = full * (1 + fold * 0.5) * (1 - easeInCubic(pinch))
    const glow = 1 - pinch
    if (seam > 0.5 && glow > 0) {
      const g = ctx.createLinearGradient(cx - seam / 2, 0, cx + seam / 2, 0)
      g.addColorStop(0, "rgba(255,255,255,0)")
      g.addColorStop(0.5, `rgba(255,255,255,${glow})`)
      g.addColorStop(1, "rgba(255,255,255,0)")
      ctx.fillStyle = g
      ctx.fillRect(cx - seam / 2, cy - 1, seam, 2)
      ctx.fillStyle = `rgba(255,255,255,${glow * 0.12})`
      ctx.fillRect(cx - seam / 2, cy - 6, seam, 12)
    }
  }

  /* ─── The frame ───────────────────────────────────────────────────── */

  let last = performance.now()

  function settle() {
    mode = "cells"
    replayAt = -1
    snappedCount = 4
    toTargets()
  }

  function draw(now: number) {
    const dt = Math.min(0.05, (now - last) / 1000)
    last = now
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    // A jolt as each part lands.
    let jolt = 0
    for (const part of parts) if (part.snapAt > 0) jolt = Math.max(jolt, 1 - (now - part.snapAt) / 170)
    if (jolt > 0) ctx.translate(rand(-1, 1) * 3 * jolt, rand(-1, 1) * 2 * jolt)

    const fade = 1 - clamp(scroll * 1.2) * 0.85
    const airy = clamp((intro.t - BEATS.instrument) / 1.2)

    // Dust in the air, once the logo has landed; the text column stays clear.
    ctx.textBaseline = "middle"
    if (airy > 0) {
      for (const m of motes) {
        const side = clamp(Math.abs(m.x - width / 2) / (width * 0.3))
        const clear = 0.18 + 0.82 * side * side
        ctx.font = `400 ${m.size}px ${FONT_STACK}`
        ctx.fillStyle = `rgba(200,200,200,${m.alpha * clear * airy * (0.6 + 0.4 * fade)})`
        ctx.fillText(m.text, m.x, m.y - scroll * 120 * m.depth)
      }
    }

    drawPrompt(now)

    ctx.globalAlpha = fade
    if (mode === "sequence") {
      // The opening's own clock, or a click replay's (the fold back, then the same hatch).
      const r = replayAt > 0 ? (now - replayAt) / 1000 : -1
      const s = r >= 0 ? HATCH - SEATED + (r - COLLAPSE) : intro.t - BEATS.egg
      if (s > SEQ_END) settle()
      else if (r >= 0 && r < COLLAPSE) drawCollapse(r, now)
      else {
        drawEgg(s, now)
        drawWord(s, now)
      }
    }
    if (mode === "cells") for (const c of word) drawCell(c, c.x, c.y, faceShade(c, now), 1)
    ctx.globalAlpha = 1

    for (const part of parts) drawCropMarks(part, now)

    // Sparks from the landings, and the bits of shell.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i]!
      const age = (now - s.born) / s.life
      if (age >= 1) {
        sparks.splice(i, 1)
        continue
      }
      if (s.gravity) {
        s.vx *= 0.98 ** (dt * 60)
        s.vy += 900 * dt
      } else {
        s.vx *= 0.9 ** (dt * 60)
        s.vy *= 0.9 ** (dt * 60)
      }
      s.x += s.vx * dt
      s.y += s.vy * dt
      ctx.font = `400 ${clamp(cw * 1.1, 10, 18)}px ${FONT_STACK}`
      ctx.fillStyle = gray(0xee, (1 - age) ** 1.5)
      ctx.textAlign = "center"
      ctx.fillText(s.glyph, s.x, s.y)
      ctx.textAlign = "left"
    }

    if (countLabel) countLabel.textContent = `parts ${snappedCount} / 4 snapped · ${pad(word.length, 3)} cells`
  }

  function step(dtFrames: number) {
    if (mode !== "cells") return
    for (const c of word) {
      const t = target(c)
      c.vx += (t.x - c.x) * 0.075 * dtFrames
      c.vy += (t.y - c.y) * 0.075 * dtFrames
      if (pointer.active) {
        const dx = c.x + cw / 2 - pointer.x
        const dy = c.y + rh / 2 - pointer.y
        const d = Math.hypot(dx, dy)
        const reach = cw * 5.5
        if (d < reach && d > 0.01) {
          const push = (1 - d / reach) ** 2 * 2.6 * dtFrames
          c.vx += (dx / d) * push
          c.vy += (dy / d) * push
        }
      }
      c.vx *= 0.8 ** dtFrames
      c.vy *= 0.8 ** dtFrames
      c.x += c.vx * dtFrames
      c.y += c.vy * dtFrames
    }
  }

  function drift(dtFrames: number) {
    for (const m of motes) {
      m.x += m.vx * dtFrames * (1 + scroll * 3)
      m.y += m.vy * dtFrames * (1 + scroll * 3)
      if (m.y < -20) m.y = height + 10
      if (m.x > width + 60) m.x = -60
    }
  }

  let lastFrame = performance.now()
  function frame(now: number) {
    if (visible && !document.hidden) {
      const dtFrames = Math.min(2.5, (now - lastFrame) / 16.67)
      step(dtFrames)
      drift(dtFrames)
      draw(now)
    } else {
      last = now
    }
    lastFrame = now
    requestAnimationFrame(frame)
  }

  layout()
  if (still) {
    // Reduced motion: the settled word, drawn once (and again on resize).
    settle()
    const paint = () => draw(performance.now())
    paint()
    new ResizeObserver(() => {
      layout()
      paint()
    }).observe(hero)
    return
  }

  requestAnimationFrame(frame)
  new ResizeObserver(() => layout()).observe(hero)
  new IntersectionObserver(([entry]) => (visible = entry!.isIntersecting)).observe(hero)
  window.addEventListener(
    "scroll",
    () => {
      scroll = clamp(window.scrollY / Math.max(1, hero.offsetHeight))
    },
    { passive: true }
  )

  hero.addEventListener("pointermove", (event) => {
    const rect = hero.getBoundingClientRect()
    pointer.x = event.clientX - rect.left
    pointer.y = event.clientY - rect.top
    pointer.active = event.pointerType === "mouse"
    if (pointerLabel) pointerLabel.textContent = `x ${pad(pointer.x, 4)} · y ${pad(pointer.y, 4)}`
  })
  hero.addEventListener("pointerleave", () => {
    pointer.active = false
  })

  // A click on the settled word folds it back into the egg and hatches it again.
  slot.addEventListener("click", () => {
    if (mode !== "cells") return
    mode = "sequence"
    replayAt = performance.now()
    snappedCount = 0
    shed.crack = false
    shed.shell = false
    for (const part of parts.slice(1)) {
      part.snapped = false
      part.snapAt = -1
    }
  })
}
