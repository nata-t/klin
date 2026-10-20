import { LID_CLOSED, logoArt, logoShade } from "@cli/ui/logo"
import { drawGeometric, FONT_STACK } from "../wizard/glyphs"
import { BEATS, intro } from "./intro"

/**
 * The hero: starter kits, snapped together.
 *
 * The logo's cells come from the CLI's own logo art — the egg (its cap and
 * its shell) and the "klin" wordmark, in the same chrome gradient as the
 * wizard's header — grouped into parts: the egg, then one per letter. The
 * opening (timed by ./intro.ts) types the create command, collapses the line
 * like a CRT switching over, then flies the egg and the letters in from all
 * sides; each lands with a flash, a jolt, crop marks closing on it and a
 * burst of sparks. Then the egg hatches — it wobbles, cracks, and the cap
 * pops up, shedding bits of shell — the chrome pours in top-down and the
 * CLI's band of light sweeps across.
 *
 * Settled, every cell lives on its own spring: the cursor nudges cells aside
 * and lights them, scrolling away lets them drift apart, and a click flies
 * the parts out, snaps them back together and hatches the egg again.
 */

interface Cell {
  col: number
  row: number
  glyph: string
  /** The egg's cap: it sits closed until the egg hatches, then pops up. */
  cap: boolean
  /** Part of the egg (cap or shell): it wobbles as one. */
  egg: boolean
  shade: number
  /** Where the band of light reaches it, 0..1 across the logo (the CLI's sweep). */
  at: number
  /** Which part it belongs to: 0 the egg, then one per letter. */
  part: number
  x: number
  y: number
  vx: number
  vy: number
  spread: [number, number]
  phase: number
}

interface Part {
  cells: Cell[]
  /** Where it flies in from, as a fraction of the hero, and how it's turned. */
  from: { dx: number; dy: number; rot: number; scale: number }
  center: { col: number; row: number }
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

const LOGO_SIZE = 10
const ROW_RATIO = 2.05
const COMMAND = "npm create klin@latest"
const DUST = "{}[]()<>;:=+*/|&!?#@$%~^.,_01xz".split("")
const TOKENS = ["z.object()", "createZodDto", "@Public()", "useAppForm", "prisma", "klin:if", "→", "✓", "z.infer", "betterAuth", "queryOptions", "@repo/validators", "turbo dev", "pnpm", "bun", "klin:only", "// TODO", "export", "import", "<Route />"]
const SPARK_GLYPHS = ["+", "·", "×", "·"]
const SHELL_GLYPHS = ["▘", "▝", "▖", "▗", "·"]

/** Where part `i` of `n` flies in from: around the hero, a fraction of its size away, a little turned. */
const partFrom = (i: number, n: number) => {
  const a = -Math.PI / 2 + (2 * Math.PI * (i + 0.5)) / n
  return { dx: Math.cos(a) * 0.62, dy: Math.sin(a) * 0.66, rot: (i % 2 ? 1 : -1) * (9 + ((i * 7) % 10)), scale: 1.3 }
}

/** Intro-time seconds between parts launching (and on a click replay), and each part's flight. */
const PART_GAP = 0.06
const REPLAY_GAP = 0.05
const FLIGHT = 0.6
/** The fraction of a flight at which the part lands (the rest is recoil). */
const IMPACT = 0.5
/** Click replay: the pull-away before the parts fly back in. */
const PULL = 0.3

/** The hatch, in seconds from its start: a wobble, the crack, the cap's hop, and settled. */
const WOBBLE = 0.5
const CRACK = 0.62
const SETTLED = 1.25

const rand = (a: number, b: number) => a + Math.random() * (b - a)
const pick = <T>(list: readonly T[]) => list[Math.floor(Math.random() * list.length)]!
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const pad = (n: number, width: number) => String(Math.round(Math.max(0, n))).padStart(width, "0")
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2)
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3
const easeInCubic = (t: number) => t * t * t

/**
 * How far a part still is from its slot during a flight: 1 at the start pose,
 * 0 in place. The approach accelerates into the slot; after impact a small
 * damped recoil carries it just past and back.
 */
function flight(local: number) {
  if (local <= 0) return 1
  if (local < IMPACT) return 1 - easeInOutCubic(local / IMPACT)
  const s = (local - IMPACT) / (1 - IMPACT)
  if (s >= 1) return 0
  return -0.035 * Math.sin(Math.PI * s * 1.5) * Math.exp(-4 * s)
}

function logoCells() {
  const art = logoArt(LOGO_SIZE)
  const columns = art.width
  const cells: Cell[] = art.cells.map((c) => ({
    col: c.col,
    row: c.row,
    glyph: c.ch,
    cap: c.kind === "cap",
    egg: c.kind === "cap" || c.kind === "shell",
    shade: logoShade(c.kind, c.row, art.height),
    at: (c.col + c.row * 2) / (columns + LOGO_SIZE * 2),
    part: c.part,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spread: [rand(-1, 1), rand(-1, 1)],
    phase: rand(0, Math.PI * 2),
  }))
  const parts: Part[] = Array.from({ length: art.parts }, (_, i) => {
    const own = cells.filter((c) => c.part === i)
    const c0 = Math.min(...own.map((c) => c.col))
    const c1 = Math.max(...own.map((c) => c.col)) + 1
    const r0 = Math.min(...own.map((c) => c.row))
    const r1 = Math.max(...own.map((c) => c.row)) + 1
    return { cells: own, from: partFrom(i, art.parts), center: { col: (c0 + c1) / 2, row: (r0 + r1) / 2 }, box: { c0, c1, r0, r1 }, snapped: false, snapAt: -1 }
  })
  const egg = parts[0]!.box
  const shellTop = Math.min(...cells.filter((c) => c.egg && !c.cap).map((c) => c.row))
  return { cells, parts, columns, faces: cells.length, egg, shellTop }
}

/**
 * The egg `t` seconds into its hatch: `lid` is how many pixels lower than at
 * rest the cap sits (negative: higher), `tilt` the whole egg's rock and
 * `capTilt` the cap's own turn as it pops.
 */
function hatchPose(t: number) {
  const closed = LID_CLOSED[20]
  if (t < 0) return { lid: closed, tilt: 0, capTilt: 0 }
  if (t < WOBBLE) {
    const k = t / WOBBLE
    return { lid: closed, tilt: 0.085 * Math.sin(k * Math.PI * 4) * (1 - k * 0.6), capTilt: 0 }
  }
  if (t < CRACK) {
    // The crack opens: the cap lifts a pixel, the egg gives one last shiver.
    const k = (t - WOBBLE) / (CRACK - WOBBLE)
    return { lid: closed - easeOutCubic(k), tilt: 0.03 * Math.sin(k * Math.PI * 2), capTilt: 0 }
  }
  if (t < SETTLED) {
    // The hop: up and a little turned, then down onto its resting place with a small bounce.
    const u = (t - CRACK) / (SETTLED - CRACK)
    const up = Math.sin(Math.PI * clamp(u / 0.7))
    const bounce = u > 0.7 ? Math.sin(Math.PI * clamp((u - 0.7) / 0.3)) : 0
    return { lid: (closed - 1) * (1 - clamp(u * 4)) - 4.5 * up - 0.7 * bounce, tilt: 0, capTilt: -0.14 * up }
  }
  return { lid: 0, tilt: 0, capTilt: 0 }
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
  const { cells, parts, columns, faces, egg, shellTop } = logoCells()

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
  /** "letters" while parts fly (the opening, or a click replay); "cells" once each cell is on its spring. */
  let mode: "letters" | "cells" = "letters"
  let replayAt = -1
  let snappedCount = 0
  /** When a click replay's hatch starts (performance.now() ms); -1 while the opening's own hatch applies. */
  let rehatchAt = -1
  /** Which hatch moments have shed their bits of shell, so each sheds once. */
  const shed = { crack: false, pop: false }

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
    oy = s.top - rect.top + (s.height - rh * LOGO_SIZE) / 2
    const count = Math.round(clamp((width * height) / 11000, 40, 130))
    motes = Array.from({ length: count }, () => {
      const word = Math.random() < 0.22
      const depth = rand(0.3, 1)
      return {
        x: rand(0, width),
        y: rand(0, height),
        vx: rand(0.02, 0.12) * depth,
        vy: -rand(0.04, 0.16) * depth,
        text: word ? pick(TOKENS) : pick(DUST),
        alpha: word ? rand(0.1, 0.22) : rand(0.12, 0.38),
        size: word ? 11 : rand(10, 14) * depth,
        depth,
      }
    })
    if (mode === "cells") toTargets()
  }

  /** A cell's resting place, drifting apart as the hero scrolls away. */
  const target = (c: Cell) => {
    const drift = scroll * scroll
    return {
      x: ox + c.col * cw + c.spread[0] * drift * width * 0.35,
      y: oy + c.row * rh - scroll * height * 0.18 + c.spread[1] * drift * height * 0.25,
    }
  }

  function toTargets() {
    for (const c of cells) {
      const t = target(c)
      c.x = t.x
      c.y = t.y
      c.vx = 0
      c.vy = 0
    }
  }

  const gray = (shade: number, alpha = 1) => `rgba(${shade},${shade},${shade},${alpha})`

  function drawCell(c: Cell, x: number, y: number, shade: number, alpha: number) {
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

  /** A face's shade: flat while it flies, then the chrome pours in top-down and the band sweeps. */
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

  /* ─── The hatch ───────────────────────────────────────────────────── */

  /** Seconds into the hatch: the opening's own, or a click replay's. */
  const hatchT = (now: number) => (rehatchAt > 0 ? (now - rehatchAt) / 1000 : intro.t - BEATS.hatch)

  /** The egg's pivot (its bottom middle) and the cap's (the middle of the crack), in hero pixels. */
  function pivots(dx = 0, dy = 0) {
    const x = ox + ((egg.c0 + egg.c1) / 2) * cw + dx
    const y = oy - scroll * height * 0.18 + dy
    return { egg: { x, y: y + egg.r1 * rh }, cap: { x, y: y + shellTop * rh } }
  }

  /** Bits of shell from along the crack: a few as it opens, a burst as the cap pops. */
  function shedShell(now: number, count: number, speed: number) {
    const p = pivots()
    const half = ((egg.c1 - egg.c0) / 2) * cw
    for (let n = 0; n < count; n++) {
      const x = p.cap.x + rand(-half, half) * 0.9
      const y = p.cap.y + rand(-rh * 0.4, rh * 0.2)
      const out = (x - p.cap.x) / half
      sparks.push({ x, y, vx: out * speed * rand(0.4, 1), vy: -speed * rand(0.5, 1.1), born: now, life: rand(520, 900), glyph: pick(SHELL_GLYPHS), gravity: true })
    }
  }

  /** Draws the egg's cells (cap and shell) as the hatch has them, at `place(cell)`. */
  function drawEgg(own: Cell[], place: (c: Cell) => { x: number; y: number }, shade: (c: Cell) => number, alpha: number, now: number, dx = 0, dy = 0) {
    const t = hatchT(now)
    const pose = hatchPose(t)
    // Only while it's hatching: a skipped or settled opening sheds nothing.
    if (t >= WOBBLE && t < SETTLED && !shed.crack) {
      shed.crack = true
      shedShell(now, 5, 90)
    }
    if (t >= CRACK && t < SETTLED && !shed.pop) {
      shed.pop = true
      shedShell(now, 14, 260)
    }
    const p = pivots(dx, dy)
    ctx.save()
    ctx.translate(p.egg.x, p.egg.y)
    ctx.rotate(pose.tilt)
    ctx.translate(-p.egg.x, -p.egg.y)
    for (const c of own) {
      if (c.cap) continue
      const at = place(c)
      drawCell(c, at.x, at.y, shade(c), alpha)
    }
    ctx.translate(p.cap.x, p.cap.y + (pose.lid * rh) / 2)
    ctx.rotate(pose.capTilt)
    ctx.translate(-p.cap.x, -p.cap.y)
    for (const c of own) {
      if (!c.cap) continue
      const at = place(c)
      drawCell(c, at.x, at.y, shade(c), alpha)
    }
    ctx.restore()
  }

  /* ─── Flights ─────────────────────────────────────────────────────── */

  /** How far part `i` is from its slot (1 = start pose, 0 = in place), at intro or replay time `when`. */
  function distance(i: number, when: number, replay: boolean) {
    if (replay) {
      const r = when
      if (r < PULL) return easeInCubic(r / PULL)
      return flight((r - PULL - i * REPLAY_GAP) / FLIGHT)
    }
    return flight((when - BEATS.parts - i * PART_GAP) / FLIGHT)
  }

  function landed(i: number, now: number) {
    const part = parts[i]!
    part.snapped = true
    part.snapAt = now
    snappedCount = Math.min(parts.length, snappedCount + 1)
    const x0 = ox + part.box.c0 * cw
    const x1 = ox + part.box.c1 * cw
    const y0 = oy + part.box.r0 * rh
    const y1 = oy + part.box.r1 * rh
    for (let n = 0; n < 9; n++) {
      // Sparks leave from the part's outline, outward.
      const side = n % 4
      const x = side === 0 ? x0 : side === 1 ? x1 : rand(x0, x1)
      const y = side === 2 ? y0 : side === 3 ? y1 : rand(y0, y1)
      const cx = (x0 + x1) / 2
      const cy = (y0 + y1) / 2
      const d = Math.hypot(x - cx, y - cy) || 1
      const speed = rand(140, 320)
      sparks.push({ x, y, vx: ((x - cx) / d) * speed, vy: ((y - cy) / d) * speed, born: now, life: rand(380, 620), glyph: pick(SPARK_GLYPHS) })
    }
  }

  function drawPart(i: number, when: number, replay: boolean, now: number) {
    const part = parts[i]!
    const p = distance(i, when, replay)
    if (!replay && when < BEATS.parts + i * PART_GAP) return
    const local = replay ? (when - PULL - i * REPLAY_GAP) / FLIGHT : (when - BEATS.parts - i * PART_GAP) / FLIGHT
    if (!part.snapped && local >= IMPACT && (!replay || when >= PULL)) landed(i, now)

    const cx = ox + part.center.col * cw
    const cy = oy + part.center.row * rh - scroll * height * 0.18
    const pose = (q: number) => {
      const far = Math.max(q, 0)
      return {
        x: part.from.dx * width * q,
        y: part.from.dy * height * q,
        rot: (part.from.rot * Math.PI * q) / 180,
        scale: 1 + (part.from.scale - 1) * far,
      }
    }
    const paint = (q: number, alpha: number, ghost: boolean) => {
      const at = pose(q)
      ctx.save()
      ctx.translate(cx + at.x, cy + at.y)
      ctx.rotate(at.rot)
      ctx.scale(at.scale, at.scale)
      ctx.translate(-cx, -cy)
      const place = (c: Cell) => ({ x: ox + c.col * cw, y: oy + c.row * rh - scroll * height * 0.18 })
      const shade = (c: Cell) => (ghost ? 0x90 : faceShade(c, now))
      if (i === 0) drawEgg(part.cells, place, shade, alpha, now)
      else for (const c of part.cells) drawCell(c, place(c).x, place(c).y, shade(c), alpha)
      ctx.restore()
    }
    // Motion trail: the part a few moments ago, fainter the further back — close enough to read as a streak.
    if (p > 0.02) {
      for (let k = 7; k >= 1; k--) {
        const q = distance(i, when - k * 0.011, replay)
        if (q > p) paint(q, 0.1 * (1 - k / 8), true)
      }
    }
    paint(p, 1, false)
  }

  /** Crop marks closing on a part as it lands, the instrument's way of saying "registered". */
  function drawCropMarks(part: Part, now: number) {
    const age = (now - part.snapAt) / 460
    if (part.snapAt < 0 || age >= 1) return
    const grow = 1 + 0.4 * (1 - easeOutCubic(clamp(age * 1.6)))
    const x0 = ox + part.box.c0 * cw
    const x1 = ox + part.box.c1 * cw
    const y0 = oy + part.box.r0 * rh - scroll * height * 0.18
    const y1 = oy + part.box.r1 * rh - scroll * height * 0.18
    const cx = (x0 + x1) / 2
    const cy = (y0 + y1) / 2
    const hw = ((x1 - x0) / 2 + 8) * grow
    const hh = ((y1 - y0) / 2 + 8) * grow
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

  /* ─── The command, before anything else ───────────────────────────── */

  function drawPrompt(now: number) {
    const t = intro.t
    if (t >= BEATS.parts + 0.2) return
    const size = clamp(cw * 1.45, 16, 27)
    ctx.font = `500 ${size}px ${FONT_STACK}`
    ctx.textBaseline = "middle"
    const typed = COMMAND.slice(0, clamp(Math.floor((t - BEATS.type) / 0.034), 0, COMMAND.length))
    const prompt = "$ "
    const full = ctx.measureText(prompt + COMMAND).width
    const cx = ox + (columns * cw) / 2
    const cy = oy + (LOGO_SIZE * rh) / 2
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

    const replaying = replayAt > 0
    const replayT = replaying ? (now - replayAt) / 1000 : 0
    if (replaying && replayT > PULL + (parts.length - 1) * REPLAY_GAP + FLIGHT + 0.05) {
      replayAt = -1
      toTargets()
    }
    if (mode === "letters" && !replaying && intro.t > BEATS.sparks + 0.6) {
      mode = "cells"
      toTargets()
    }

    ctx.globalAlpha = fade
    if (mode === "letters" || replaying) {
      for (let i = 0; i < parts.length; i++) drawPart(i, replaying ? replayT : intro.t, replaying, now)
    } else {
      for (const c of cells) if (!c.egg) drawCell(c, c.x, c.y, faceShade(c, now), 1)
      // The egg's cells sit on their springs too; the hatch moves them from where they are.
      drawEgg(
        parts[0]!.cells,
        (c) => ({ x: c.x, y: c.y }),
        (c) => faceShade(c, now),
        1,
        now
      )
    }

    ctx.globalAlpha = 1

    for (const part of parts) drawCropMarks(part, now)

    // Sparks from the landings.
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

    if (countLabel) countLabel.textContent = `parts ${snappedCount} / ${parts.length} snapped · ${pad(faces, 3)} cells`
  }

  function step(dtFrames: number) {
    if (mode !== "cells" || replayAt > 0) return
    for (const c of cells) {
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
      step(Math.min(2.5, (now - lastFrame) / 16.67))
      draw(now)
    } else {
      last = now
    }
    lastFrame = now
    requestAnimationFrame(frame)
  }

  layout()
  if (still) {
    // Reduced motion: the settled logo, drawn once (and again on resize).
    snappedCount = parts.length
    mode = "cells"
    toTargets()
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

  // A click on the settled logo flies the parts out, snaps them back and hatches the egg again.
  slot.addEventListener("click", () => {
    if (mode !== "cells" || replayAt > 0) return
    replayAt = performance.now()
    rehatchAt = replayAt + (PULL + FLIGHT * IMPACT + 0.2) * 1000
    shed.crack = false
    shed.pop = false
    snappedCount = 0
    for (const part of parts) {
      part.snapped = false
      part.snapAt = -1
    }
  })
}
