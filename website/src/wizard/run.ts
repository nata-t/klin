import manifestJson from "../../../template/klin.template.json"
import { buildProgress, wizard } from "@cli/commands/wizard"
import { type Manifest, normalizeAnswers, stepsFor, validateManifest } from "@cli/engine/manifest"
import { markImage } from "@cli/ui/logo"
import { CANCEL } from "@cli/ui/prompts"
import { commandFor, type Picks } from "./command"
import { terminalSize } from "./shims/process"
import { screen } from "./shims/term"
import { Terminal } from "./terminal"

const manifest = manifestJson as unknown as Manifest
validateManifest(manifest)

// This terminal is a canvas, so it can draw the egg before the version (glyphs.ts draws MARK_GLYPH).
markImage.on = true

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export interface WizardHandlers {
  /** The visitor finished the wizard: here's the command for their picks. */
  done(command: string, picks: Picks): void
  /** The wizard (re)started. */
  started(): void
  /** Columns × rows changed. */
  resized?(columns: number, rows: number): void
}

/**
 * Runs the CLI's own wizard in an on-page terminal. When the visitor builds,
 * the progress page plays (nothing is written anywhere — it's a preview), and
 * `done` receives the `create klin` command that recreates their picks.
 */
export function mountWizard(host: HTMLElement, input: HTMLTextAreaElement, handlers: WizardHandlers) {
  const terminal = new Terminal(host, input)
  terminal.onResize = (columns, rows) => handlers.resized?.(columns, rows)
  handlers.resized?.(terminalSize.columns, terminalSize.rows)
  let run = 0

  async function start() {
    const id = ++run
    handlers.started()
    const result = await wizard({
      manifest,
      cwd: "/home/you/code",
      name: "my-app",
      pm: "bun",
      pmVersions: { bun: "1.3.14", pnpm: "11.20.0", npm: "11.6.2" },
      preset: "recommended",
      answers: normalizeAnswers(manifest, {}).answers,
      force: false,
      install: true,
      git: true,
    })
    if (id !== run) return
    if (result === CANCEL || typeof result === "symbol") {
      // Esc on the first page: start over, as if the command had been run again.
      screen.close()
      await wait(250)
      if (id === run) void start()
      return
    }
    const picks: Picks = { name: result.name, pm: result.pm, preset: result.preset, answers: result.answers }
    await build(id, picks)
    if (id !== run) return
    handlers.done(commandFor(manifest, picks), picks)
  }

  async function build(id: number, picks: Picks) {
    const progress = buildProgress({
      heading: "Snapping it together.",
      subtitle: `./${picks.name} · ${picks.pm} · a preview — nothing is written`,
      labels: ["Base", ...stepsFor(manifest).map((step) => step.title), "Build"],
      plan: [
        "Sweeping the template",
        "Laying everything out",
        "Initializing git",
        `Installing dependencies with ${picks.pm}`,
        "Generating the Prisma client",
        "Making the first commit",
      ],
    })
    const tasks: [title: string, done: string, ms: number, details: string[]][] = [
      ["Sweeping the template", "Swept the template into shape", 380, []],
      ["Laying everything out", `Wrote ./${picks.name} with a fresh .env (new secrets, just for you)`, 260, []],
      ["Initializing git", "Initialized a git repository", 200, []],
      [`Installing dependencies with ${picks.pm}`, `Installed dependencies with ${picks.pm}`, 1500, ["· resolving packages", "· politely asking the registry for packages", "· fluffing node_modules"]],
      ["Generating the Prisma client", "Generated the Prisma client", 450, []],
      ["Making the first commit", "Committed the initial state", 260, []],
    ]
    for (const [title, done, ms, details] of tasks) {
      if (id !== run) break
      await progress.reporter(
        title,
        async (update) => {
          if (!details.length) return wait(ms)
          for (const detail of details) {
            update(detail)
            await wait(ms / details.length)
          }
        },
        { done: () => done }
      )
    }
    await wait(500)
    progress.stop()
  }

  return {
    terminal,
    start,
    /** Throws away the current run and opens the wizard again. */
    restart() {
      screen.close()
      void start()
    },
    focus: () => terminal.focus(),
    text: () => terminal.text(),
  }
}
