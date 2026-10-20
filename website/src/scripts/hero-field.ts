import { eggPixels, HERO_GRID, SX, SY, wordmarkCells } from "../lib/hero-logo"
import { drawGeometric, FONT_STACK } from "../wizard/glyphs"
import { BEATS, intro } from "./intro"

/**
 * The hero: KLIN hatches.
 *
 * Everything sits on one grid of square pixels (../lib/hero-logo.ts): the
 * egg, rasterized from the vector mark, and the KLIN wordmark the CLI draws
 * — its ANSI Shadow letters split into pixels, the box-drawing shadow that
 * echoes them down and to the right, and its sparkles. The opening (timed by
 * ./intro.ts) types the create command, collapses the line like a CRT
 * switching over, then drops the egg in: it lands with a flash, a jolt, crop
 * marks and a burst of sparks. The egg wobbles, cracks and pops its cap
 * away; the shell breaks up and its pixels fly out as K, L, I and N, which
 * land one after another. Then the shadow extrudes behind the letters, the
 * chrome pours in top-down, the CLI's band of light sweeps across and the
 * sparkles pop.
 *
 * Settled, every pixel and shadow cell lives on its own spring: the cursor
 * nudges them aside and lights them, scrolling away lets them drift apart,
 * and a click folds KLIN back into the egg and hatches it again.
 */

type Kind = "cap" | "shell" | "face" | "shadow" | "spark"

interface Cell {
  /** Where it sits, in grid pixels, and its size: one pixel, or a whole wordmark cell (SX × SY) for a glyph. */
  col: number
  row: number
  w: number
  h: number
  glyph: string
  kind: Kind
  shade: number
  /** Where the band of light reaches it, 0..1 across the logo (the CLI's sweep). */
  at: number
  /** 0 the egg (and the sparkles), then 1–4 for K, L, I, N. */
  part: number
  /** A face pixel: the spot inside the egg it hatches from, and how late it leaves. */
  from: { col: number; row: number }
  delay: number
  x: number
  y: number
  vx: number
  vy: number
  spread: [number, number]
  phase: number
}

interface Part {
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

const COMMAND = "npm create klin@latest"
const DUST = "{}[]()<>;:=+*/|&!?#@$%~^.,_01xz".split("")
const TOKENS = ["z.object()", "createZodDto", "@Public()", "useAppForm", "prisma", "klin:if", "→", "✓", "z.infer", "betterAuth", "queryOptions", "@repo/validators", "turbo dev", "pnpm", "bun", "klin:only", "// TODO", "export", "import", "<Route />"]
const SPARK_GLYPHS = ["+", "·", "×", "·"]
const SHELL_GLYPHS = ["▘", "▝", "▖", "▗", "·"]

/*
 * The sequence, in seconds from the egg's launch (`s`): the drop and its
 * landing, the hatch, the letters, their shadow and the sparkles. The beats
 * in ./intro.ts place it.
 */
const FLIGHT = 0.6
/** The fraction of the drop at which the egg lands (the rest is recoil). */
const IMPACT = 0.5
const HATCH = BEATS.hatch - BEATS.egg
const WOBBLE = 0.45
const CRACK = 0.1
const POP = 0.45
const WORD = BEATS.word - BEATS.egg
const DEPTH = BEATS.depth - BEATS.egg
const SPARKLE = BEATS.sparks - BEATS.egg
const SHELL_FADE = 0.3
/** Each letter leaves a little after the last; its pixels straggle by up to JITTER. */
const LETTER_GAP = 0.08
const JITTER = 0.07
const TRAVEL = 0.6
const SEQ_END = WORD + 3 * LETTER_GAP + JITTER + TRAVEL + 0.05
/** Click replay: KLIN folds back into the egg, which sits for a moment before it hatches again. */
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

/** One unit of the egg's vector geometry, in grid pixels. */
const EGG_UNIT = HERO_GRID.egg.scale

/**
 * The egg `t` seconds into its hatch: `lid` is how many pixels lower than at
 * rest the cap sits (negative: higher), `tilt` the egg's rock, `capTilt` the
 * cap's own turn and `capAlpha` how much of it is left as it flies off.
 * Closed, the cap drops by its lift and the crack's gap (12 + 12 units).
 */
function hatchPose(t: number) {
  const closed = 24 * EGG_UNIT
  if (t < 0) return { lid: closed, tilt: 0, capTilt: 0, capAlpha: 1 }
  if (t < WOBBLE) {
    const k = t / WOBBLE
    return { lid: closed, tilt: 0.085 * Math.sin(k * Math.PI * 4) * (1 - k * 0.6), capTilt: 0, capAlpha: 1 }
  }
  if (t < WOBBLE + CRACK) {
    // The crack opens: the cap lifts a little, the egg gives one last shiver.
    const k = (t - WOBBLE) / CRACK
    return { lid: closed - 10 * EGG_UNIT * easeOutCubic(k), tilt: 0.03 * Math.sin(k * Math.PI * 2), capTilt: 0, capAlpha: 1 }
  }
  // The cap pops off: up, turning, and gone.
  const u = clamp((t - WOBBLE - CRACK) / POP)
  return { lid: closed - (10 + 150 * easeOutCubic(u)) * EGG_UNIT, tilt: 0, capTilt: -0.6 * u, capAlpha: 1 - easeInCubic(u) }
}

function heroCells() {
  const { columns, rows, top } = HERO_GRID
  const cell = (c: Partial<Cell> & Pick<Cell, "col" | "row" | "kind">): Cell => ({
    w: 1,
    h: 1,
    glyph: "",
    shade: 0xb4,
    at: (c.col + c.row / 2) / (columns + rows / 2),
    part: 0,
    from: { col: c.col, row: c.row },
    delay: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spread: [rand(-1, 1), rand(-1, 1)],
    phase: rand(0, Math.PI * 2),
    ...c,
  })
  const egg = eggPixels().map((p) => cell({ col: p.col, row: p.row, kind: p.kind }))
  const shell = egg.filter((c) => c.kind === "shell")
  // The faces' chrome runs down the five rows of letters, pixel by pixel.
  const faceRows = 5 * SY
  const faces: Cell[] = []
  const shadows: Cell[] = []
  const sparkles: Cell[] = []
  for (const w of wordmarkCells()) {
    if (w.kind === "face") {
      for (let y = 0; y < SY; y++)
        for (let x = 0; x < SX; x++) {
          const row = w.row + y
          const at = pick(shell)
          faces.push(
            cell({
              col: w.col + x,
              row,
              kind: "face",
              part: w.part,
              shade: Math.round(0xfa - (0xfa - 0xa4) * Math.min(1, (row - top) / (faceRows - 1))),
              from: { col: at.col, row: at.row },
              delay: rand(0, JITTER),
            }),
          )
        }
    } else (w.kind === "shadow" ? shadows : sparkles).push(cell({ col: w.col, row: w.row, w: SX, h: SY, glyph: w.ch, kind: w.kind, part: w.part, shade: w.level }))
  }
  const box = (cells: Cell[]) => ({
    c0: Math.min(...cells.map((c) => c.col)),
    c1: Math.max(...cells.map((c) => c.col + c.w)),
    r0: Math.min(...cells.map((c) => c.row)),
    r1: Math.max(...cells.map((c) => c.row + c.h)),
  })
  const parts: Part[] = [egg, ...[1, 2, 3, 4].map((i) => [...faces, ...shadows].filter((c) => c.part === i))].map((cells) => ({
    box: box(cells),
    snapped: false,
    snapAt: -1,
  }))
  const shellTop = Math.min(...shell.map((c) => c.row))
  return { egg, faces, shadows, sparkles, parts, shellTop }
}

export function mountHeroField(hero: HTMLElement) {
  const canvas = hero.querySelector<HTMLCanvasElement>("canvas")!
  const slot = hero.querySelector<HTMLElement>("[data-logo-slot]")!
  const countLabel = hero.querySelector<HTMLElement>("[data-hero-count]")
  const pointerLabel = hero.querySelector<HTMLElement>("[data-hero-pointer]")
  const maybe = canvas.getContext("2d")
  if (!maybe) return
  const ctx: CanvasRenderingContext2D = maybe
  hero.dataset.field = "on"

  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const { columns, rows } = HERO_GRID
  const { egg, faces, shadows, sparkles, parts, shellTop } = heroCells()
  const eggPart = parts[0]!
  const eggBox = eggPart.box
  /** What lives on springs once the opening is over: the letters' pixels and their shadow. */
  const springs = [...faces, ...shadows]

  let width = 0
  let height = 0
  let dpr = 1
  /** A grid pixel's size on screen. */
  let px = 6
  let ox = 0
  let oy = 0
  let motes: Mote[] = []
  const sparks: Spark[] = []

  const pointer = { x: -9999, y: -9999, active: false }
  let visible = true
  let scroll = 0
  /** "sequence" while the egg drops and hatches (the opening, or a click replay); "cells" once KLIN is on its springs. */
  let mode: "sequence" | "cells" = "sequence"
  /** When the last click replay started (performance.now() ms), or -1: the opening's clock applies. */
  let replayAt = -1
  let snappedCount = 0
  /** Which hatch moments have shed their bits of shell, so each sheds once a run. */
  const shed = { crack: false, shell: false }

  function layout() {
    const rect = hero.getBoundingClientRect()
    const s = slot.getBoundingClientRect()
    width = rect.width
    height = rect.height
    dpr = Math.min(3, window.devicePixelRatio || 1)
    // The canvas is sized in whole device pixels and shown at exactly that size, so nothing gets resampled (blurred).
    canvas.width = Math.round(width * dpr)
    canvas.height = Math.round(height * dpr)
    canvas.style.width = `${canvas.width / dpr}px`
    canvas.style.height = `${canvas.height / dpr}px`
    px = s.width / columns
    ox = s.left - rect.left + (s.width - px * columns) / 2
    oy = s.top - rect.top + (s.height - px * rows) / 2
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
  const spot = (col: number, row: number) => ({ x: ox + col * px, y: oy + row * px - scroll * height * 0.18 })

  /** A cell's resting place, drifting apart as the hero scrolls away. */
  const target = (c: Cell) => {
    const drift = scroll * scroll
    return {
      x: ox + c.col * px + c.spread[0] * drift * width * 0.35,
      y: oy + c.row * px - scroll * height * 0.18 + c.spread[1] * drift * height * 0.25,
    }
  }

  function toTargets() {
    for (const c of springs) {
      const t = target(c)
      c.x = t.x
      c.y = t.y
      c.vx = 0
      c.vy = 0
    }
  }

  const gray = (shade: number, alpha = 1) => `rgba(${shade},${shade},${shade},${alpha})`

  /** Fill colors by shade and alpha (in twentieths), so thousands of pixels a frame don't each build a string. */
  const fills = new Map<number, string>()
  function fill(shade: number, alpha: number) {
    const s = Math.round(clamp(shade, 0, 255))
    const a = Math.round(clamp(alpha) * 20)
    const key = s * 32 + a
    let color = fills.get(key)
    if (!color) fills.set(key, (color = gray(s, a / 20)))
    return color
  }

  /**
   * One pixel, crisp: its edges snap to device pixels, so neighbours at rest
   * share an edge exactly. `bleed` oversizes it a hair where the canvas is
   * turned and edges can't line up.
   */
  function drawPixel(x: number, y: number, shade: number, alpha: number, bleed = 0, g: CanvasRenderingContext2D = ctx) {
    if (alpha <= 0.02) return
    g.fillStyle = fill(shade, alpha)
    const x0 = Math.round(x * dpr) / dpr
    const y0 = Math.round(y * dpr) / dpr
    const x1 = Math.round((x + px) * dpr) / dpr
    const y1 = Math.round((y + px) * dpr) / dpr
    g.fillRect(x0, y0, Math.max(x1 - x0, 1 / dpr) + bleed, Math.max(y1 - y0, 1 / dpr) + bleed)
  }

  /** A shadow cell: its box-drawing glyph, drawn as lines — the echoes of the letter above and to the left. */
  function drawShadow(c: Cell, x: number, y: number, alpha: number) {
    if (alpha <= 0.02) return
    drawGeometric(ctx, c.glyph, Math.round(x * dpr) / dpr, Math.round(y * dpr) / dpr, c.w * px, c.h * px, gray(Math.round(c.shade), alpha), 1)
  }

  /** A sparkle: its glyph, centred in its cell. */
  function drawSparkle(c: Cell, x: number, y: number, alpha: number) {
    if (alpha <= 0.02) return
    // As big as the old hero drew them: about one and a half cell widths.
    ctx.font = `400 ${c.w * px * 1.45}px ${FONT_STACK}`
    ctx.fillStyle = gray(c.shade, alpha)
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.fillText(c.glyph, x + (c.w * px) / 2, y + (c.h * px) / 2)
    ctx.textAlign = "left"
  }

  /* ─── Looks over time ─────────────────────────────────────────────── */

  /** A pixel's shade: flat until the chrome pours in top-down and the band sweeps; lit by the cursor and by landings. */
  function faceShade(c: Cell, now: number) {
    const pour = clamp((intro.t - BEATS.chrome - (c.row / rows) * 0.5) / 0.3)
    let shade = 0xb4 + (c.shade - 0xb4) * easeOutCubic(pour)
    const band = (intro.t - BEATS.chrome - 0.16) / 0.8
    if (band > 0 && band < 1) {
      const at = -0.3 + band * 1.6
      shade += (0xff - shade) * Math.max(0, 1 - Math.abs(c.at - at) * 6)
    }
    if (pointer.active && mode === "cells") {
      const d = Math.hypot(c.x + px / 2 - pointer.x, c.y + px / 2 - pointer.y)
      shade += (0xff - shade) * clamp(1 - d / 160) * 0.8
    }
    const part = parts[c.part]
    if (part && part.snapAt > 0) {
      const flash = 1 - (now - part.snapAt) / 110
      if (flash > 0) shade += (0xff - shade) * flash
    }
    return shade
  }

  /** The shadow extrudes behind the letters once they've landed, along the sweep's diagonal: how far, and from where. */
  function shadowState(c: Cell, s: number) {
    const k = easeOutCubic(clamp((s - DEPTH - c.at * 0.3) / 0.22))
    return { k, dx: -(1 - k) * c.w * px * 0.5, dy: -(1 - k) * c.h * px * 0.3 }
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

  /** Bits of shell: a few from along the crack as it opens, a burst from the whole shell as it breaks. */
  function shedShell(now: number, count: number, speed: number, whole: boolean) {
    const a = spot(eggBox.c0, whole ? shellTop : shellTop - 1)
    const b = spot(eggBox.c1, whole ? eggBox.r1 : shellTop + 1)
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
   * The egg's two layers. Each frame its pixels are painted flat into them
   * (snapped, upright), then each layer is drawn as one image under the
   * drop's and the rock's turns, so a turned egg stays clean instead of
   * showing hundreds of turned squares — and an upright one is copied 1:1.
   */
  const layers = { shell: document.createElement("canvas"), cap: document.createElement("canvas") }
  function bake(kind: "shell" | "cap", shade: (c: Cell) => number) {
    const layer = layers[kind]
    const w = (eggBox.c1 - eggBox.c0) * px
    const h = (eggBox.r1 - eggBox.r0) * px
    const pw = Math.ceil(w * dpr) + 2
    const ph = Math.ceil(h * dpr) + 2
    if (layer.width !== pw || layer.height !== ph) {
      layer.width = pw
      layer.height = ph
    }
    const g = layer.getContext("2d")!
    g.setTransform(1, 0, 0, 1, 0, 0)
    g.clearRect(0, 0, pw, ph)
    g.setTransform(dpr, 0, 0, dpr, 0, 0)
    for (const c of egg) if (c.kind === kind) drawPixel((c.col - eggBox.c0) * px, (c.row - eggBox.r0) * px, shade(c), 1, 0, g)
    return { layer, w: pw / dpr, h: ph / dpr }
  }

  /** A snapshot of a layer, so it can be baked again in the same frame. */
  const ghosts = { a: document.createElement("canvas"), b: document.createElement("canvas") }
  let ghostFlip = false
  function copy(source: HTMLCanvasElement) {
    const t = (ghostFlip = !ghostFlip) ? ghosts.a : ghosts.b
    t.width = source.width
    t.height = source.height
    t.getContext("2d")!.drawImage(source, 0, 0)
    return t
  }

  /**
   * Draws the egg `s` seconds into the sequence: dropping in (with a motion
   * trail), landing, hatching, then breaking away. `fade` scales it all (the
   * replay fades it in as KLIN folds back).
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
    const corner = spot(eggBox.c0, eggBox.r0)
    // The layers sit on whole device pixels, like the pixels drawn straight onto the canvas.
    const x0 = Math.round(corner.x * dpr) / dpr
    const y0 = Math.round(corner.y * dpr) / dpr
    const base = ctx.globalAlpha
    const image = (baked: ReturnType<typeof bake>, alpha: number) => {
      if (alpha <= 0) return
      ctx.globalAlpha = base * alpha
      ctx.drawImage(baked.layer, x0, y0, baked.w, baked.h)
      ctx.globalAlpha = base
    }
    const paint = (q: number, alpha: number, shell: ReturnType<typeof bake>, cap: ReturnType<typeof bake>) => {
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
      if (breakK > 0) {
        // Breaking, the shell crumbles: each bit tumbles its own way and falls as it fades.
        for (const c of egg) {
          if (c.kind !== "shell") continue
          const at = spot(c.col, c.row)
          const k = clamp(breakK * (0.7 + 0.3 * Math.abs(c.spread[1])))
          const dx = (at.x - center.x) * k * 0.25 + c.spread[0] * k * px * 5
          const dy = k * k * px * 12 + c.spread[1] * k * px * 2
          drawPixel(at.x + dx, at.y + dy, faceShade(c, now), alpha * shellAlpha * (1 - k * 0.3))
        }
      } else image(shell, alpha * shellAlpha)
      ctx.translate(crack.x, crack.y + pose.lid * px)
      ctx.rotate(pose.capTilt)
      ctx.translate(-crack.x, -crack.y)
      image(cap, alpha * capAlpha)
      ctx.restore()
    }
    // Only the opening drops it; a replay's egg is already sitting there.
    const q = s < FLIGHT && replayAt < 0 ? flight(s / FLIGHT) : 0
    // Motion trail: the egg a few moments ago, fainter the further back, in a flat gray.
    if (q > 0.02) {
      const shell = bake("shell", () => 0x90)
      const ghostShell = { ...shell, layer: copy(shell.layer) }
      const cap = bake("cap", () => 0x90)
      const ghostCap = { ...cap, layer: copy(cap.layer) }
      for (let k = 5; k >= 1; k--) {
        const past = flight((s - k * 0.014) / FLIGHT)
        if (past > q) paint(past, 0.1 * (1 - k / 6), ghostShell, ghostCap)
      }
    }
    paint(q, 1, bake("shell", (c) => faceShade(c, now)), bake("cap", (c) => faceShade(c, now)))
  }

  /* ─── KLIN ────────────────────────────────────────────────────────── */

  /** The letters hatching: each face pixel flies from its spot in the egg to its place, rising as it leaves. */
  function drawLetters(s: number, now: number) {
    for (let i = 1; i <= 4; i++) {
      const lands = WORD + (i - 1) * LETTER_GAP + JITTER + TRAVEL * 0.55
      if (!parts[i]!.snapped && s >= lands && s < SEQ_END) landed(i, now, 6)
    }
    for (const c of faces) {
      const k = (s - WORD - (c.part - 1) * LETTER_GAP - c.delay) / TRAVEL
      if (k <= 0) continue
      const e = easeOutBack(clamp(k))
      const from = spot(c.from.col, c.from.row)
      const to = spot(c.col, c.row)
      const y = lerp(from.y, to.y, e) - Math.sin(Math.PI * clamp(k)) * px * 9
      drawPixel(lerp(from.x, to.x, e), y, faceShade(c, now), clamp(k * 4))
    }
  }

  /** The shadow, extruding at its beat; `at` places each cell (its rest, or its spring). */
  function drawShadows(s: number, at: (c: Cell) => { x: number; y: number }, alpha = 1) {
    for (const c of shadows) {
      const st = shadowState(c, s)
      if (st.k <= 0) continue
      const p = at(c)
      drawShadow(c, p.x + st.dx, p.y + st.dy, st.k * alpha)
    }
  }

  /** The sparkles pop in at their beat, turning, then twinkle. */
  function drawSparkles(s: number, now: number, alpha = 1) {
    sparkles.forEach((c, i) => {
      const k = clamp((s - SPARKLE - i * 0.06) / 0.35)
      if (k <= 0) return
      const t = target(c)
      const pop = easeOutBack(k)
      ctx.save()
      ctx.translate(t.x + (c.w * px) / 2, t.y + (c.h * px) / 2)
      ctx.rotate((1 - k) * Math.PI)
      ctx.scale(pop, pop)
      ctx.translate(-(t.x + (c.w * px) / 2), -(t.y + (c.h * px) / 2))
      drawSparkle(c, t.x, t.y, alpha * (0.55 + 0.45 * Math.sin(now / 520 + c.phase)))
      ctx.restore()
    })
  }

  /** A click replay's first moments: the letters fold back into the egg as it fades in, closed; the shadow and the sparkles go out. */
  function drawCollapse(r: number, now: number) {
    const k = clamp(r / COLLAPSE)
    const e = easeInCubic(k)
    const out = 1 - clamp(r / 0.2)
    drawShadows(999, (c) => ({ x: c.x, y: c.y }), out)
    drawSparkles(999, now, out)
    for (const c of faces) {
      const from = spot(c.from.col, c.from.row)
      drawPixel(lerp(c.x, from.x, e), lerp(c.y, from.y, e), faceShade(c, now), 1 - clamp((k - 0.55) / 0.45))
    }
    drawEgg(HATCH - SEATED, now, clamp((k - 0.35) / 0.65))
  }

  /* ─── The command, before anything else ───────────────────────────── */

  function drawPrompt(now: number) {
    const t = intro.t
    if (t >= BEATS.egg + 0.2) return
    const size = clamp(px * 3, 16, 27)
    ctx.font = `500 ${size}px ${FONT_STACK}`
    ctx.textBaseline = "middle"
    const typed = COMMAND.slice(0, clamp(Math.floor((t - BEATS.type) / 0.034), 0, COMMAND.length))
    const prompt = "$ "
    const full = ctx.measureText(prompt + COMMAND).width
    const cx = ox + (columns * px) / 2
    const cy = oy + (rows * px) / 2
    const x = cx - full / 2

    if (t < BEATS.enter) {
      ctx.fillStyle = gray(0x6a)
      ctx.fillText(prompt, x, cy)
      const left = x + ctx.measureText(prompt).width
      ctx.fillStyle = gray(0xee)
      ctx.fillText(typed, left, cy)
      const typing = typed.length < COMMAND.length && t > BEATS.type
      if (typing || Math.floor(now / 530) % 2 === 0) {
        ctx.fillStyle = gray(0xee)
        ctx.fillRect(left + ctx.measureText(typed).width + 2, cy - size * 0.55, size * 0.55, size * 1.1)
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

  /** Seconds into the sequence: the opening's clock, or the last click replay's (its fold back, then the same hatch). */
  const seqTime = (now: number) => (replayAt > 0 ? HATCH - SEATED + ((now - replayAt) / 1000 - COLLAPSE) : intro.t - BEATS.egg)

  function settle() {
    mode = "cells"
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
    const s = seqTime(now)
    if (mode === "sequence") {
      const r = replayAt > 0 ? (now - replayAt) / 1000 : -1
      if (s > SEQ_END) settle()
      else if (r >= 0 && r < COLLAPSE) drawCollapse(r, now)
      else {
        drawShadows(s, (c) => spot(c.col, c.row))
        drawEgg(s, now)
        drawLetters(s, now)
        drawSparkles(s, now)
      }
    }
    if (mode === "cells") {
      drawShadows(s, (c) => ({ x: c.x, y: c.y }))
      for (const c of faces) drawPixel(c.x, c.y, faceShade(c, now), 1)
      drawSparkles(s, now)
    }
    ctx.globalAlpha = 1

    for (const part of parts) drawCropMarks(part, now)

    // Sparks from the landings, and the bits of shell.
    for (let i = sparks.length - 1; i >= 0; i--) {
      const sp = sparks[i]!
      const age = (now - sp.born) / sp.life
      if (age >= 1) {
        sparks.splice(i, 1)
        continue
      }
      if (sp.gravity) {
        sp.vx *= 0.98 ** (dt * 60)
        sp.vy += 900 * dt
      } else {
        sp.vx *= 0.9 ** (dt * 60)
        sp.vy *= 0.9 ** (dt * 60)
      }
      sp.x += sp.vx * dt
      sp.y += sp.vy * dt
      ctx.font = `400 ${clamp(px * 2.4, 10, 18)}px ${FONT_STACK}`
      ctx.fillStyle = gray(0xee, (1 - age) ** 1.5)
      ctx.textAlign = "center"
      ctx.fillText(sp.glyph, sp.x, sp.y)
      ctx.textAlign = "left"
    }

    if (countLabel) countLabel.textContent = `parts ${snappedCount} / 4 snapped · ${pad(faces.length + shadows.length, 4)} cells`
  }

  function step(dtFrames: number) {
    if (mode !== "cells") return
    for (const c of springs) {
      const t = target(c)
      c.vx += (t.x - c.x) * 0.075 * dtFrames
      c.vy += (t.y - c.y) * 0.075 * dtFrames
      if (pointer.active) {
        const dx = c.x + px / 2 - pointer.x
        const dy = c.y + px / 2 - pointer.y
        const d = Math.hypot(dx, dy)
        const reach = px * 10
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
    // Reduced motion: the settled wordmark, drawn once (and again on resize).
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

  // A click on the settled wordmark folds it back into the egg and hatches it again.
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
