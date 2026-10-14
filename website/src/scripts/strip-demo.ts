import authSource from "klin-template:packages/auth/src/auth.ts"
import { type Answers, normalizeAnswers, resolveFlags } from "@cli/engine/manifest"
import { processMarkers } from "@cli/engine/markers"
import { manifest } from "../lib/manifest"
import { highlight } from "./highlight"

/**
 * "Only what you picked": three real excerpts of the template's auth.ts
 * (imports, the database adapter, the plugin list), run through the CLI's
 * own marker engine with the flags the picks resolve to.
 *
 * To show which template lines survive, each line is tagged with an invisible
 * /*§n*\/ before processing; the tags that come out are the kept lines.
 */

const lines = authSource.replace(/\r\n/g, "\n").split("\n")
const from = (match: (line: string) => boolean, start = 0) => lines.findIndex((l, i) => i >= start && match(l))

const excerpts = (() => {
  const appName = from((l) => l.startsWith("const APP_NAME"))
  const authStart = from((l) => l.startsWith("export const auth = betterAuth({"))
  const dbEnd = from((l) => l === "  }),", authStart)
  const pluginsStart = from((l) => l === "  plugins: [")
  const pluginsEnd = from((l) => l === "  ],", pluginsStart)
  if ([appName, authStart, dbEnd, pluginsStart, pluginsEnd].some((i) => i < 0)) throw new Error("auth.ts changed shape")
  return [lines.slice(0, appName - 1), lines.slice(authStart, dbEnd + 1), lines.slice(pluginsStart, pluginsEnd + 1)]
})()

const DIRECTIVE = /^\s*(\/\/|#)\s*klin:(if|elif|else|endif|file)\b/
const DORMANT = /^(\s*)(\/\/\? ?)(.*)$/

interface SourceLine {
  n: number
  text: string
  directive: boolean
}

let counter = 0
const blocks = excerpts.map((chunk) =>
  chunk.map((text): SourceLine => ({ n: counter++, text, directive: DIRECTIVE.test(text) }))
)

function tag(line: SourceLine) {
  if (line.directive || !line.text.trim()) return line.text
  const dormant = DORMANT.exec(line.text)
  if (dormant) return `${dormant[1]}${dormant[2]}/*§${line.n}*/${dormant[3]}`
  const ws = /^\s*/.exec(line.text)![0]
  return `${ws}/*§${line.n}*/${line.text.slice(ws.length)}`
}

function render(answers: Answers) {
  const flags = resolveFlags(manifest, normalizeAnswers(manifest, answers).answers, "pnpm")
  const kept = new Set<number>()
  const output = blocks.map((block) => {
    const result = processMarkers(block.map(tag).join("\n"), flags, "auth.ts") ?? ""
    return result.split("\n").map((line) => {
      const match = /\/\*§(\d+)\*\//.exec(line)
      if (match) kept.add(Number(match[1]))
      return { n: match ? Number(match[1]) : -1, text: line.replace(/\/\*§\d+\*\//, "") }
    })
  })
  return { kept, output }
}

const ELLIPSIS = "  // …"

export function mountStripDemo(root: HTMLElement) {
  const sourceEl = root.querySelector<HTMLElement>("[data-strip-source]")!
  const resultEl = root.querySelector<HTMLElement>("[data-strip-result]")!
  const countEl = root.querySelector<HTMLElement>("[data-strip-count]")!
  const dbChips = [...root.querySelectorAll<HTMLButtonElement>("[data-strip-db] [data-value]")]
  const flagChips = [...root.querySelectorAll<HTMLButtonElement>("[data-strip-flags] [data-value]")]

  let database = "postgres"
  const picked = new Set(["password"])
  let before = new Set<number>()

  const authIds = new Set(manifest.questions.find((q) => q.id === "auth")!.options)

  function update(first = false) {
    const answers: Answers = {
      database,
      auth: [...picked].filter((id) => authIds.has(id)),
      plugins: [...picked].filter((id) => !authIds.has(id)),
    }
    const { kept, output } = render(answers)

    sourceEl.innerHTML = blocks
      .map((block) =>
        block
          .map((line) => {
            const cls = line.directive ? "marker" : line.text.trim() && !kept.has(line.n) ? "drop" : ""
            const html = line.directive
              ? line.text.replace(/(klin:\w+)(.*)$/, '<span class="m">$1</span>$2')
              : highlight(line.text)
            return `<span class="line ${cls}">${html || " "}</span>`
          })
          .join("")
      )
      .join(`<span class="line marker">${ELLIPSIS}</span>`)

    resultEl.innerHTML = output
      .map((block) =>
        block
          .map((line) => {
            const fresh = !first && line.n >= 0 && !before.has(line.n)
            return `<span class="line${fresh ? " new" : ""}">${highlight(line.text) || " "}</span>`
          })
          .join("")
      )
      .join(`<span class="line marker">${ELLIPSIS}</span>`)

    const total = blocks.flat().filter((l) => !l.directive && l.text.trim()).length
    countEl.textContent = `${kept.size} of ${total} lines kept`
    before = kept
  }

  dbChips.forEach((chip) =>
    chip.addEventListener("click", () => {
      database = chip.dataset.value!
      dbChips.forEach((c) => {
        const on = c === chip
        c.setAttribute("aria-checked", String(on))
        c.querySelector(".mark")!.textContent = on ? "●" : "○"
      })
      update()
    })
  )
  flagChips.forEach((chip) =>
    chip.addEventListener("click", () => {
      const id = chip.dataset.value!
      if (picked.has(id)) picked.delete(id)
      else picked.add(id)
      chip.setAttribute("aria-pressed", String(picked.has(id)))
      chip.querySelector(".mark")!.textContent = picked.has(id) ? "◼" : "◻"
      update()
    })
  )

  update(true)
}
