/**
 * The landing page's opening, as one clock every part reads, so it plays as
 * a single sequence:
 *
 *   type        a cursor types `npm create klin@latest`
 *   enter       the line collapses like a CRT switching over
 *   parts       K, L, I and N fly in as separate parts and snap together
 *   depth       the shadow layer extrudes behind them
 *   chrome      the chrome gradient pours in, the CLI's light band sweeps
 *   sparks      the sparkles pop
 *   instrument  the nav and the scroll ruler assemble
 *   copy        the headline and the rest of the hero arrive
 *
 * `intro.t` is intro time in seconds. Any input (wheel, key, pointer, touch)
 * fast-forwards it — nothing jump-cuts, everything plays faster. Returning
 * visitors get it compressed from the start, and visitors who prefer reduced
 * motion get the settled page right away.
 */

export const BEATS = {
  type: 0.25,
  enter: 1.05,
  parts: 1.22,
  depth: 2.12,
  chrome: 2.28,
  sparks: 2.62,
  instrument: 2.5,
  copy: 2.72,
  done: 3.6,
} as const

export type Beat = keyof typeof BEATS

export const intro = { t: 0, scale: 1, done: false }

const SEEN_KEY = "klin-intro-seen"
const RETURN_SCALE = 1.9
const FAST_SCALE = 4.5

const waiting = new Map<Beat, (() => void)[]>()
const fired = new Set<Beat>()

/** Runs `fn` when the clock reaches `beat` (right away if it already has). */
export function at(beat: Beat, fn: () => void) {
  if (fired.has(beat)) return fn()
  const list = waiting.get(beat) ?? []
  list.push(fn)
  waiting.set(beat, list)
}

function fire(beat: Beat) {
  if (fired.has(beat)) return
  fired.add(beat)
  for (const fn of waiting.get(beat) ?? []) fn()
  waiting.delete(beat)
}

function settle() {
  intro.t = 999
  intro.done = true
  for (const beat of Object.keys(BEATS) as Beat[]) fire(beat)
  document.documentElement.classList.remove("intro")
}

function run() {
  const root = document.documentElement
  // No opening for reduced motion, or when the visit starts away from the hero (a reload mid-page, a #link).
  const elsewhere = (location.hash && location.hash !== "#intro") || window.scrollY > window.innerHeight * 0.3
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !root.classList.contains("intro") || elsewhere) {
    settle()
    return
  }
  try {
    if (localStorage.getItem(SEEN_KEY) === "1") intro.scale = RETURN_SCALE
  } catch {
    // Storage blocked: play the full opening.
  }

  const hurry = () => {
    intro.scale = Math.max(intro.scale, FAST_SCALE)
  }
  const events = ["wheel", "keydown", "pointerdown", "touchstart"] as const
  for (const e of events) window.addEventListener(e, hurry, { passive: true })

  let last = performance.now()
  const ordered = (Object.entries(BEATS) as [Beat, number][]).sort((a, b) => a[1] - b[1])
  const tick = (now: number) => {
    // A hidden tab doesn't advance the clock: the opening waits for you.
    const dt = document.hidden ? 0 : Math.min(0.1, (now - last) / 1000)
    last = now
    intro.t += dt * intro.scale
    for (const [beat, time] of ordered) if (intro.t >= time) fire(beat)
    if (intro.t >= BEATS.done) {
      intro.done = true
      root.classList.remove("intro")
      for (const e of events) window.removeEventListener(e, hurry)
      try {
        localStorage.setItem(SEEN_KEY, "1")
      } catch {
        // Fine: they'll see the whole opening again.
      }
      return
    }
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

run()
