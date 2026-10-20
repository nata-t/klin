import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { ACTS } from "../lib/grow-acts"
import { styleLine } from "../lib/term-lines"

/**
 * The "after day one" story: the terminal pins while you scroll, and the
 * scroll position types each command and prints its output line by line —
 * scrub-linked, so scrolling back un-prints it. Small screens and reduced
 * motion get the three transcripts stacked instead.
 */
gsap.registerPlugin(ScrollTrigger)

export function mountGrowStory(story: HTMLElement) {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const wide = window.matchMedia("(min-width: 960px)")
  const screen = story.querySelector<HTMLElement>("[data-story-screen]")!
  const progressEl = story.querySelector<HTMLElement>("[data-story-progress]")!
  const acts = [...story.querySelectorAll<HTMLElement>("[data-act]")]
  let trigger: ScrollTrigger | undefined
  let lastKey = ""

  function paint(progress: number) {
    const span = progress * ACTS.length
    const index = Math.min(ACTS.length - 1, Math.floor(span))
    const local = Math.min(1, span - index)
    const act = ACTS[index]!
    const typed = Math.round(Math.min(1, local / 0.18) * act.command.length)
    const shown = local < 0.22 ? 0 : Math.round(Math.min(1, (local - 0.22) / 0.62) * act.output.length)
    const key = `${index}:${typed}:${shown}`
    if (key === lastKey) return
    lastKey = key

    const done = typed >= act.command.length
    const lines = [
      `<span class="cmdline"><span class="prompt">$</span> ${act.command.slice(0, typed)}${shown === 0 ? '<span class="caret"></span>' : ""}</span>`,
      ...(done && shown > 0 ? ["", ...act.output.slice(0, shown).map(styleLine)] : []),
    ]
    screen.innerHTML = lines.join("\n")
    // Like a terminal: once the output outgrows the window, the newest line stays at the bottom.
    screen.scrollTop = screen.scrollHeight
    progressEl.textContent = `${index + 1} / ${ACTS.length}`
    acts.forEach((el, i) => {
      const state = i < index ? "passed" : i === index ? "here" : "ahead"
      el.dataset.state = state
      el.querySelector("[data-mark]")!.textContent = state === "passed" ? "✓" : state === "here" ? "◆" : "○"
    })
  }

  function setup() {
    trigger?.kill()
    trigger = undefined
    if (still || !wide.matches) {
      story.dataset.mode = "static"
      return
    }
    story.dataset.mode = "story"
    paint(0)
    trigger = ScrollTrigger.create({
      trigger: story,
      start: () => `top ${document.querySelector<HTMLElement>("#site-nav")!.offsetHeight + 56}px`,
      end: () => `+=${window.innerHeight * 2.6}`,
      pin: true,
      pinSpacing: true,
      scrub: 0.4,
      onUpdate: (self) => paint(self.progress),
    })
  }

  setup()
  wide.addEventListener("change", () => {
    setup()
    ScrollTrigger.refresh()
  })
}
