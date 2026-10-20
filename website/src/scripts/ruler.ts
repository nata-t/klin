import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { STEPS } from "../lib/site"
import { at, intro } from "./intro"
import { lenis } from "./motion"

/**
 * The scroll ruler: the scrollbar as an instrument, in the CLI's vocabulary.
 *
 * A tick track runs 1:1 with the document (tick p% sits p% down the page) and
 * moves with the scroll; the needle travels the viewport like a scrollbar
 * thumb and always points at the tick for its own percentage, because the
 * track carries a small offset that reconciles the two. So the ticks, the
 * needle, its readout and a click all agree.
 *
 * Each section has a marker and its name on the spine, ✓ passed, ◆ here,
 * ○ ahead — flipping exactly where the nav's step indicator does. Ticks near
 * the needle stretch with scroll speed. Hovering folds the whole page into the
 * rail (a map, with the visible slice in crop marks) and a ghost line shows
 * where a click would land; clicking jumps there, dragging scrubs.
 *
 * Fine pointers on wide screens only; everyone else keeps the native
 * scrollbar. With reduced motion the rail is static and the native scrollbar
 * stays.
 */

gsap.registerPlugin(ScrollTrigger)

const NAV_H = 52
const PAD = 16
/** Where the nav flips sections: a section is "here" once its top passes 45% of the viewport. */
const FLIP = 0.45

interface Tick {
  pct: number
  row: HTMLElement
  line: HTMLElement
  label?: HTMLElement
  alpha: number
}

interface Section {
  id: string
  label: string
  index: number
  pct: number
  row: HTMLElement
  spine: HTMLElement
  glyph: HTMLElement
  /** The spine label's length, measured with the page (not every frame). */
  len: number
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v))
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))
const pad3 = (n: number) => String(Math.round(n)).padStart(3, "0")
const el = (tag: string, cls: string, parent?: HTMLElement) => {
  const node = document.createElement(tag)
  node.className = cls
  parent?.append(node)
  return node
}

export function mountRuler(rail: HTMLElement) {
  const mobileUa = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent)
  const capable = window.matchMedia("(pointer: fine) and (hover: hover) and (min-width: 1024px)")
  const still = window.matchMedia("(prefers-reduced-motion: reduce)")
  let teardown: (() => void) | undefined
  const apply = () => {
    teardown?.()
    teardown = undefined
    if (!mobileUa && capable.matches) teardown = build(rail, still.matches)
  }
  apply()
  capable.addEventListener("change", apply)
  still.addEventListener("change", apply)
}

function build(rail: HTMLElement, still: boolean): () => void {
  const root = document.documentElement
  root.dataset.ruler = still ? "static" : "on"
  rail.hidden = false
  rail.innerHTML = ""
  rail.setAttribute("role", "scrollbar")
  rail.setAttribute("aria-label", "Page position")
  rail.setAttribute("aria-controls", "main")
  rail.setAttribute("aria-orientation", "vertical")
  rail.setAttribute("aria-valuemin", "0")
  rail.setAttribute("aria-valuemax", "100")

  // Frost: whatever passes under the rail blurs, feathering out toward the page.
  el("div", "absolute inset-0 bg-[rgba(20,20,20,0.58)] backdrop-blur-[9px] [mask-image:linear-gradient(to_left,#000_55%,rgba(0,0,0,0.6)_75%,transparent)]", rail)
  el("div", "absolute inset-y-0 right-0 w-px bg-rule", rail)
  const track = el("div", "absolute inset-x-0 top-0 will-change-transform", rail)
  // The map's "you are here": the visible slice of the page, in crop marks.
  const bracket = el(
    "div",
    "absolute top-0 right-px left-6 h-0 bg-[rgba(255,255,255,0.05)] opacity-0 before:absolute before:inset-x-0 before:top-0 before:h-7 before:border before:border-b-0 before:border-bright after:absolute after:inset-x-0 after:bottom-0 after:h-7 after:border after:border-t-0 after:border-bright",
    rail
  )
  // The needle: where you are, meeting its own tick.
  const needle = el("div", "absolute inset-x-0 top-0 h-0 will-change-[transform,opacity]", rail)
  el("div", "absolute inset-x-0 top-0 h-px bg-white shadow-[0_0_8px_rgba(255,255,255,0.55)]", needle)
  const chip = el(
    "div",
    "absolute top-4 left-4 flex items-center rounded-[2px] bg-bright px-4 py-1 text-[9px] leading-[1.35] font-[650] tracking-[0.06em] text-bg transition-[top] duration-180 ease-[ease]",
    needle
  )
  const digits = el("span", "inline-flex h-[1.35em] overflow-hidden", chip)
  const columns = [0, 1, 2].map(() => {
    const col = el("span", "flex flex-col transition-[transform] duration-280 ease-[cubic-bezier(0.2,0.9,0.2,1)]", digits)
    col.innerHTML = "0123456789".split("").map((d) => `<span class="h-[1.35em] tabular-nums">${d}</span>`).join("")
    return col
  })
  chip.append("%")

  // The hover ghost: where a click would take you.
  const ghost = el("div", "pointer-events-none fixed top-0 right-0 z-41 h-0 w-260 opacity-0 transition-[opacity] duration-150 ease-linear", document.body)
  ghost.setAttribute("aria-hidden", "true")
  el("div", "absolute top-0 right-0 h-px w-ruler bg-muted", ghost)
  const ghostLabel = el(
    "div",
    "absolute top-0 right-[calc(var(--spacing-ruler)+8px)] rounded-[3px] border border-line bg-[rgba(20,20,20,0.92)] px-7 py-3 font-mono text-[10px] tracking-[0.1em] whitespace-nowrap text-text uppercase transform-[translateY(-50%)] [&_b]:font-[650] [&_b]:text-bright",
    ghost
  )

  /* ─── The track ───────────────────────────────────────────────────── */

  // A tick every half percent; longer every 5%, labeled every 10%.
  const ticks: Tick[] = []
  for (let half = 0; half <= 200; half++) {
    const pct = half / 2
    const major = half % 20 === 0
    const mid = half % 10 === 0
    const whole = half % 2 === 0
    const row = el("div", "absolute inset-x-0 h-0", track)
    const line = el("span", "absolute top-0 right-0 h-px origin-right bg-bright", row)
    line.style.width = `${major ? 16 : mid ? 11 : whole ? 7 : 4}px`
    const alpha = major ? 0.75 : mid ? 0.48 : whole ? 0.32 : 0.2
    line.style.opacity = String(alpha)
    let label: HTMLElement | undefined
    if (major) {
      label = el(
        "span",
        "absolute top-0 right-21 text-[8.5px] tracking-[0.08em] text-muted tabular-nums transition-[opacity] duration-200 ease-linear transform-[translateY(-50%)]",
        row
      )
      label.textContent = pad3(pct)
    }
    ticks.push({ pct: pct / 100, row, line, label, alpha })
  }

  const sections: Section[] = []
  STEPS.forEach((step, index) => {
    if (!document.getElementById(step.id)) return
    // A section's marker: a long rule and its name on the spine, reading down.
    const row = el("div", "group/row absolute inset-x-0 h-0", track)
    row.dataset.state = index === 0 ? "here" : "ahead"
    el("span", "absolute top-0 right-0 h-px w-30 bg-bright", row)
    const spine = el(
      "span",
      "absolute top-7 right-34 text-[9px] tracking-[0.16em] whitespace-nowrap text-subtle uppercase transition-[color,opacity] duration-[250ms,200ms] ease-linear [writing-mode:vertical-rl] group-data-[state=here]/row:font-[650] group-data-[state=here]/row:text-bright group-data-[state=passed]/row:text-muted",
      row
    )
    const glyph = el("span", "mb-6 inline-block", spine)
    glyph.textContent = index === 0 ? "◆" : "○"
    spine.append(` ${String(index + 1).padStart(2, "0")} ${step.label}`)
    sections.push({ id: step.id, label: step.label, index, pct: 0, row, spine, glyph, len: 0 })
  })

  /* ─── Geometry ────────────────────────────────────────────────────── */

  let docH = 0
  let vh = 0
  const measure = () => {
    docH = document.documentElement.scrollHeight
    vh = window.innerHeight
    track.style.height = `${docH}px`
    for (const t of ticks) t.row.style.top = `${t.pct * docH}px`
    const max = Math.max(1, docH - vh)
    for (const s of sections) {
      const top = document.getElementById(s.id)!.getBoundingClientRect().top + window.scrollY
      s.pct = clamp((top - FLIP * vh) / max)
      s.row.style.top = `${s.pct * docH}px`
      s.len = s.spine.offsetHeight
    }
  }
  measure()
  const ro = new ResizeObserver(measure)
  ro.observe(document.body)
  window.addEventListener("resize", measure)
  ScrollTrigger.addEventListener("refresh", measure)
  document.fonts?.ready.then(measure).catch(() => {})

  const map = () => {
    const base = NAV_H + PAD
    return { base, span: Math.max(1, vh - NAV_H - 2 * PAD), drift: (p: number) => base - p * (NAV_H + 2 * PAD) }
  }

  /* ─── The opening: ticks draw in from the edge, top down ──────────── */

  let ready = still || intro.done
  if (!ready) {
    gsap.set(
      ticks.map((t) => t.line),
      { scaleX: 0 }
    )
    at("instrument", () => {
      gsap.to(
        ticks.map((t) => t.line),
        {
          scaleX: 1,
          duration: 0.5,
          stagger: 0.003,
          ease: "power3.out",
          onComplete: () => {
            ready = true
          },
        }
      )
    })
  }

  /* ─── Every frame ─────────────────────────────────────────────────── */

  const state = { vel: 0, lastY: window.scrollY, pct: -1, digits: [-1, -1, -1], current: 0, chipAbove: false }
  const zoom = { target: 0, p: 0, intent: false, dragging: false, wrote: false }
  const pointer = { active: false, y: 0, startY: 0, moved: 0 }

  const frame = (_time: number, deltaMs: number) => {
    if (!vh) return
    const dt = Math.min(0.1, deltaMs / 1000) || 0.016
    const scrollY = window.scrollY
    const max = Math.max(1, docH - vh)
    const progress = clamp(scrollY / max)
    const raw = (scrollY - state.lastY) / dt
    state.lastY = scrollY
    state.vel += (raw - state.vel) * (1 - Math.exp(-6 * dt))

    const m = map()
    const drift = m.drift(progress)
    track.style.transform = `translate3d(0, ${-scrollY + drift}px, 0)`

    const ny = m.base + progress * m.span
    needle.style.transform = `translate3d(0, ${ny}px, 0)`
    needle.style.opacity = String(clamp(progress / 0.015))
    const above = ny > vh - 24
    if (above !== state.chipAbove) {
      state.chipAbove = above
      chip.style.top = above ? "-17px" : "4px"
    }

    const pct = Math.round(progress * 100)
    if (pct !== state.pct) {
      state.pct = pct
      rail.setAttribute("aria-valuenow", String(pct))
      const str = pad3(pct)
      for (let c = 0; c < 3; c++) {
        const d = str.charCodeAt(c) - 48
        if (d !== state.digits[c]) {
          state.digits[c] = d
          columns[c]!.style.transform = `translateY(${-d * 1.35}em)`
        }
      }
    }

    // ✓ passed · ◆ here · ○ ahead, flipping where the nav does.
    let current = 0
    for (const s of sections) if (progress + 1e-4 >= s.pct) current = s.index
    if (current !== state.current) {
      state.current = current
      for (const s of sections) {
        const st = s.index < current ? "passed" : s.index === current ? "here" : "ahead"
        s.row.dataset.state = st
        s.glyph.textContent = st === "passed" ? "✓" : st === "here" ? "◆" : "○"
      }
    }

    // Fold into the map on hover (or while dragging); the needle stays put, the page compresses onto it.
    zoom.target = zoom.intent || zoom.dragging ? 1 : 0
    zoom.p = still ? zoom.target : zoom.p + (zoom.target - zoom.p) * (1 - Math.exp(-9 * dt))
    if (zoom.target === 0 && zoom.p < 0.001) zoom.p = 0
    if (zoom.target === 1 && zoom.p > 0.999) zoom.p = 1
    const z = zoom.p

    bracket.style.transform = `translate3d(0, ${m.base + (scrollY / docH) * m.span}px, 0)`
    bracket.style.height = `${(vh / docH) * m.span}px`
    bracket.style.opacity = String(z)

    const fold = (pctOf: number, row: HTMLElement) => {
      if (z <= 0 && !zoom.wrote) return
      const liveY = pctOf * docH - scrollY + drift
      const compactY = m.base + pctOf * m.span
      row.style.transform = z > 0 ? `translate3d(0, ${z * (compactY - liveY)}px, 0)` : ""
    }
    // A section's name needs room before the next marker; where sections sit close (the map), it steps aside.
    const yOf = (pct: number) => {
      const liveY = pct * docH - scrollY + drift
      return liveY + z * (m.base + pct * m.span - liveY)
    }
    sections.forEach((s, i) => {
      fold(s.pct, s.row)
      const next = sections[i + 1]
      const room = next ? yOf(next.pct) - yOf(s.pct) : Infinity
      const need = s.len + 14
      s.spine.style.opacity = String(clamp((room - need) / 16))
    })

    const velNorm = clamp(Math.abs(state.vel) / 2800)
    const needleDocY = progress * docH
    for (const t of ticks) {
      fold(t.pct, t.row)
      // Numbers step out of the needle chip's way.
      if (t.label) {
        const y = t.pct * docH - scrollY + drift + z * (m.base + t.pct * m.span - (t.pct * docH - scrollY + drift))
        const gap = Math.abs(y - (ny + (state.chipAbove ? -10 : 10)))
        t.label.style.opacity = String(clamp((gap - 8) / 10) * (0.85 - z * 0.25))
      }
      if (!ready || still) continue
      const dist = Math.abs(t.pct * docH - needleDocY)
      const reach = 160
      if (dist < reach && z < 0.5) {
        const k = 1 - dist / reach
        const boost = velNorm * k * k
        t.line.style.transform = `scaleX(${1 + 1.6 * boost})`
        t.line.style.opacity = String(Math.min(1, t.alpha + 0.6 * boost))
      } else {
        t.line.style.transform = ""
        t.line.style.opacity = String(t.alpha)
      }
    }
    zoom.wrote = z > 0

    // The ghost: where a click would land, and in which section.
    if (pointer.active) {
      const y = clamp(pointer.y, m.base, m.base + m.span)
      const p = (y - m.base) / m.span
      let name = sections[0]?.label ?? ""
      for (const s of sections) if (p + 1e-4 >= s.pct) name = s.label
      ghost.style.transform = `translate3d(0, ${y}px, 0)`
      ghost.style.opacity = String(0.35 + 0.65 * z)
      ghostLabel.innerHTML = `→ <b>${pad3(p * 100)}</b> · ${name}`
    } else {
      ghost.style.opacity = "0"
    }
  }
  gsap.ticker.add(frame)

  /* ─── Pointer ─────────────────────────────────────────────────────── */

  const progressAt = (clientY: number) => {
    const m = map()
    return clamp((clientY - m.base) / m.span)
  }
  const jump = (clientY: number) => {
    const target = progressAt(clientY) * Math.max(1, docH - vh)
    if (lenis) {
      const distance = Math.abs(target - window.scrollY)
      lenis.scrollTo(target, { duration: 0.6 + 0.9 * Math.min(1, distance / (vh * 3)), easing: easeOutExpo })
    } else {
      window.scrollTo({ top: target })
    }
  }

  // Hover intent: the map forms after a short beat, so grazing the edge of the screen doesn't fire it.
  let intentTimer: ReturnType<typeof setTimeout> | undefined
  const onEnter = () => {
    clearTimeout(intentTimer)
    pointer.active = true
    intentTimer = setTimeout(() => (zoom.intent = true), 140)
  }
  const onLeave = () => {
    if (zoom.dragging) return
    clearTimeout(intentTimer)
    pointer.active = false
    intentTimer = setTimeout(() => (zoom.intent = false), 220)
  }
  const onMove = (event: PointerEvent) => {
    pointer.y = event.clientY
    if (!zoom.dragging) return
    pointer.moved = Math.max(pointer.moved, Math.abs(event.clientY - pointer.startY))
    const target = progressAt(event.clientY) * Math.max(1, docH - vh)
    if (lenis) lenis.scrollTo(target, { lerp: 0.22 })
    else window.scrollTo({ top: target })
  }
  const onDown = (event: PointerEvent) => {
    event.preventDefault()
    pointer.startY = event.clientY
    pointer.moved = 0
    zoom.dragging = true
    rail.setPointerCapture(event.pointerId)
  }
  const onUp = (event: PointerEvent) => {
    if (!zoom.dragging) return
    zoom.dragging = false
    const r = rail.getBoundingClientRect()
    const inside = event.clientX >= r.left && event.clientX <= r.right && event.clientY >= r.top && event.clientY <= r.bottom
    if (!inside) {
      pointer.active = false
      clearTimeout(intentTimer)
      intentTimer = setTimeout(() => (zoom.intent = false), 220)
    }
  }
  const onClick = (event: MouseEvent) => {
    if (pointer.moved > 4) return
    jump(event.clientY)
  }
  rail.addEventListener("pointerenter", onEnter)
  rail.addEventListener("pointerleave", onLeave)
  rail.addEventListener("pointermove", onMove)
  rail.addEventListener("pointerdown", onDown)
  rail.addEventListener("pointerup", onUp)
  rail.addEventListener("pointercancel", onUp)
  rail.addEventListener("click", onClick)

  return () => {
    gsap.ticker.remove(frame)
    ro.disconnect()
    window.removeEventListener("resize", measure)
    ScrollTrigger.removeEventListener("refresh", measure)
    rail.removeEventListener("pointerenter", onEnter)
    rail.removeEventListener("pointerleave", onLeave)
    rail.removeEventListener("pointermove", onMove)
    rail.removeEventListener("pointerdown", onDown)
    rail.removeEventListener("pointerup", onUp)
    rail.removeEventListener("pointercancel", onUp)
    rail.removeEventListener("click", onClick)
    clearTimeout(intentTimer)
    ghost.remove()
    rail.innerHTML = ""
    rail.hidden = true
    delete root.dataset.ruler
  }
}
