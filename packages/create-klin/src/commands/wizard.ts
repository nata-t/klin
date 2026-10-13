import { existsSync } from "node:fs"
import { basename, relative, resolve } from "node:path"
import { VERSION } from "../context"
import {
  type Answers,
  type Manifest,
  normalizeAnswers,
  PACKAGE_MANAGERS,
  type PackageManager,
  selectedOptions,
  stepsFor,
} from "../engine/manifest"
import { type ChipField, type Field, Form, type InputField, type Page, type ProgressField } from "../ui/form"
import { CANCEL, type Cancel } from "../ui/prompts"
import { setTaskReporter, type TaskReporter } from "../ui/task"
import { screen } from "../ui/term"
import { parseColor } from "../ui/theme"
import { isEmptyDir } from "../utils/fs"
import { isValidPackageName, toSlug } from "../utils/names"

/**
 * The interactive `create` flow — six steps at most:
 *
 *   1 Base     name, package manager, starting point (preset)
 *   2–5        the template's own steps (stack, auth, toolbox, looks)
 *   6 Build    review, then build with live progress
 */

export interface WizardInput {
  manifest: Manifest
  cwd: string
  name?: string
  pm: PackageManager
  pmVersions: Record<PackageManager, string | null>
  preset: string
  answers: Answers
  /** --force: don't ask before sweeping a non-empty folder. */
  force: boolean
  /** What "build" will do, for the review page. */
  install: boolean
  git: boolean
}

export interface WizardResult {
  name: string
  pm: PackageManager
  preset: string
  answers: Answers
  /** The user agreed to empty the target folder first. */
  wipe: boolean
}

const PM_ABOUT: Record<PackageManager, string> = {
  bun: "Bun's very fast installer, with scripts run through bun run — the default. Workspaces go in package.json, and klin rewrites every command for you.",
  pnpm: "Fast installs from a shared store with strict node_modules. The monorepo is wired with pnpm-workspace.yaml.",
  npm: "Comes with Node.js, so there's nothing else to install. Workspaces go in package.json; installs are slower but it works everywhere.",
}

const NAME_ABOUT =
  "This becomes the folder and the package name. Use lowercase letters, numbers and dashes — spaces turn into dashes as you type."

export async function wizard(input: WizardInput): Promise<WizardResult | Cancel> {
  const { manifest } = input
  const state = {
    pm: input.pm,
    preset: input.preset,
    answers: structuredClone(input.answers),
    wipe: false,
  }
  const steps = stepsFor(manifest)
  const labels = ["Base", ...steps.map((s) => s.title), "Build"]
  let current = 0

  /* ─── Name ──────────────────────────────────────────────────────────── */
  const nameField: InputField = {
    kind: "input",
    id: "name",
    label: "Name your kit",
    hint: "(folder + package name)",
    about: NAME_ABOUT,
    placeholder: "my-klin-app",
    value: input.name ?? "",
    caret: (input.name ?? "").length,
    filter: (ch) => (ch === " " ? "-" : /[\w.\-/@]/.test(ch) ? ch : ""),
    validate: (value) => describeName(input.cwd, value || "my-klin-app"),
  }
  const name = () => nameField.value || "my-klin-app"
  const slug = () => toSlug(basename(resolve(input.cwd, name()))) || "my-klin-app"
  const targetDir = () => resolve(input.cwd, name())

  /* ─── Answers ───────────────────────────────────────────────────────── */
  const label = (id: string) => manifest.options[id]?.label ?? id
  const questionOf = (id: string) => manifest.questions.find((q) => q.options.includes(id))!
  const isOn = (id: string) => selectedOptions(manifest, state.answers).includes(id)

  function turnOn(id: string) {
    const q = questionOf(id)
    if (q.type === "select") state.answers[q.id] = id
    else state.answers[q.id] = [...new Set([...((state.answers[q.id] as string[]) ?? []), id])]
  }
  function turnOff(id: string) {
    const q = questionOf(id)
    if (q.type === "multiselect") state.answers[q.id] = ((state.answers[q.id] as string[]) ?? []).filter((o) => o !== id)
  }

  /** Snap an option on/off, bringing along (or dropping) the options that depend on each other. */
  function toggle(id: string): string | void {
    const q = questionOf(id)
    if (q.type === "select") {
      state.answers[q.id] = id
      return
    }
    if (isOn(id)) {
      turnOff(id)
      const dependents = selectedOptions(manifest, state.answers).filter((o) => manifest.options[o]?.requires?.includes(id))
      dependents.forEach(turnOff)
      if (dependents.length) return `${dependents.map(label).join(", ")} went too — ${dependents.length === 1 ? "it needs" : "they need"} ${label(id)}.`
      return
    }
    turnOn(id)
    const added = (manifest.options[id]?.requires ?? []).filter((r) => !isOn(r))
    added.forEach(turnOn)
    if (added.length) return `${added.map(label).join(", ")} snapped on too — ${label(id)} needs it.`
  }

  function applyPreset(id: string) {
    state.preset = id
    state.answers = structuredClone(manifest.presets?.[id]?.answers ?? {})
    try {
      state.answers = normalizeAnswers(manifest, state.answers).answers
    } catch {
      // keep what we have; the review step reports problems
    }
  }
  if (Object.keys(state.answers).length === 0) applyPreset(state.preset)
  else state.answers = normalizeAnswers(manifest, state.answers).answers

  /* ─── Pages ─────────────────────────────────────────────────────────── */
  const keys = (): Page["keys"] =>
    current === labels.length - 1
      ? [
          ["enter", "build it"],
          ["esc", "back"],
        ]
      : [
          ["space", "snap"],
          ["←↑↓→", "move"],
          ["enter", current === labels.length - 2 ? "review" : "next"],
          ["esc", current === 0 ? "quit" : "back"],
        ]

  const chipFieldsFor = (questionIds: string[]): Field[] =>
    questionIds.flatMap((qid) => {
      const q = manifest.questions.find((x) => x.id === qid)!
      const groups = q.groups ?? [{ title: q.title ?? q.id, options: q.options }]
      return groups.map(
        (group): ChipField => ({
          kind: "chips",
          id: `${q.id}:${group.title}`,
          title: group.title,
          note: q.type === "select" ? "pick one" : q.required ? "pick at least one" : "pick any",
          multi: q.type === "multiselect",
          items: group.options.map((id) => {
            const option = manifest.options[id]!
            return { id, label: option.label, about: option.about ?? option.hint, swatch: option.swatch ? parseColor(option.swatch) : undefined }
          }),
          isOn,
          toggle,
        })
      )
    })

  const basePage = (): Page => ({
    version: `v${VERSION}`,
    steps: { labels, current: 0 },
    heading: "Starter kits, snapped together.",
    subtitle: "Pick a base. Snap on parts. Ship before lunch.",
    fields: [
      nameField,
      {
        kind: "chips",
        id: "pm",
        title: "Package manager",
        note: "pick one",
        multi: false,
        items: PACKAGE_MANAGERS.map((pm) => ({
          id: pm,
          label: input.pmVersions[pm] ? `${pm} ${input.pmVersions[pm]}` : pm,
          about: PM_ABOUT[pm],
          disabled: input.pmVersions[pm] ? undefined : `isn't installed here — install it, or pick another`,
        })),
        isOn: (id) => id === state.pm,
        toggle: (id) => {
          state.pm = id as PackageManager
        },
      },
      {
        kind: "chips",
        id: "preset",
        title: "Start from",
        note: "pick one · fine-tune next",
        multi: false,
        items: Object.entries(manifest.presets ?? {}).map(([id, preset]) => ({ id, label: preset.label, about: preset.about ?? preset.hint })),
        isOn: (id) => id === state.preset,
        toggle: (id) => {
          applyPreset(id)
          return `${manifest.presets?.[id]?.label} loaded — every part is still yours to change.`
        },
      },
    ],
    keys: keys(),
  })

  const stepPage = (index: number): Page => {
    const step = steps[index - 1]!
    return {
      version: `v${VERSION}`,
      steps: { labels, current: index },
      heading: step.heading,
      subtitle: step.subtitle,
      fields: chipFieldsFor(step.questions),
      keys: keys(),
    }
  }

  const reviewPage = (): Page => {
    const answers = normalizeAnswers(manifest, state.answers).answers
    const list = (qid: string) => {
      const value = answers[qid]
      const ids = Array.isArray(value) ? value : value ? [value] : []
      return ids.length ? ids.map(label).join(", ") : "none"
    }
    const dir = relative(input.cwd, targetDir()) || "."
    const does = [
      "writes the files",
      input.git ? "starts a git repository" : undefined,
      input.install ? `installs dependencies with ${state.pm}` : undefined,
      input.install ? "generates the Prisma client" : undefined,
      input.git ? "makes the first commit" : undefined,
    ].filter(Boolean)
    return {
      version: `v${VERSION}`,
      steps: { labels, current: labels.length - 1 },
      heading: "Ready to snap it together.",
      subtitle: `./${dir}${state.wipe ? " — swept clean first" : ""}`,
      fields: [
        {
          kind: "summary",
          id: "review",
          rows: [
            ["name", slug()],
            ["stack", `${label(answers.backend as string)} on ${label(answers.server as string)} · ${label(answers.database as string)}`],
            ["sign-in", list("auth")],
            ["power-ups", list("plugins")],
            ["security", list("security")],
            ["extras", list("extras")],
            ["ui", `${label(answers.components as string)} · ${label(answers.accent as string)}`],
            ["tooling", `${state.pm} ${input.pmVersions[state.pm] ?? ""}`.trim()],
          ],
        },
      ],
      keys: keys(),
      help: {
        title: "Enter builds it",
        text: `klin ${does.join(", ").replace(/, ([^,]*)$/, " and $1")}. Esc goes back to change anything.`,
      },
    }
  }

  const pageFor = (index: number) => (index === 0 ? basePage() : index === labels.length - 1 ? reviewPage() : stepPage(index))

  /* ─── Loop ──────────────────────────────────────────────────────────── */
  const forms = new Map<number, Form>()
  const formFor = (index: number) => {
    let form = forms.get(index)
    if (!form) {
      form = new Form(pageFor(index))
      forms.set(index, form)
    }
    // Rebuild the page (labels, status, review rows) but keep the cursor.
    form.page = pageFor(index)
    return form
  }

  return new Promise<WizardResult | Cancel>((done) => {
    let form = formFor(0)

    const go = (index: number) => {
      current = index
      form = formFor(index)
      screen.paint()
    }

    const finish = () =>
      done({ name: name(), pm: state.pm, preset: state.preset, answers: normalizeAnswers(manifest, state.answers).answers, wipe: state.wipe })

    const submitBase = () => {
      const check = describeName(input.cwd, name())
      if (check.tone === "error") {
        form.focus("name")
        form.say("error", check.message)
        return
      }
      if (!isEmptyDir(targetDir()) && !input.force && !state.wipe) {
        form.modal = {
          title: `./${relative(input.cwd, targetDir()) || "."} isn't empty`,
          text: "klin can sweep it clean first — everything inside gets deleted. Or pick another name.",
          choices: [
            ["y", "sweep it clean"],
            ["n", "pick another name"],
          ],
        }
        return
      }
      go(1)
    }

    const submitStep = () => {
      const step = steps[current - 1]!
      const missing = step.questions
        .map((id) => manifest.questions.find((q) => q.id === id)!)
        .find((q) => q.type === "multiselect" && q.required && ((state.answers[q.id] as string[]) ?? []).length === 0)
      if (missing) {
        const index = form.page.fields.findIndex((f) => f.id.startsWith(`${missing.id}:`))
        if (index >= 0) form.cursor = { field: index, item: 0 }
        form.say("error", `Pick at least one ${(missing.title ?? missing.id).toLowerCase()} option.`)
        return
      }
      go(current + 1)
    }

    screen.present({
      render: (w, h) => {
        form.page = pageFor(current)
        return form.render(w, h)
      },
      key: (key) => {
        if (form.modal) {
          if (key.name === "y") {
            form.modal = undefined
            state.wipe = true
            go(1)
          } else if (key.name === "n" || key.name === "escape") {
            form.modal = undefined
            form.focus("name")
            screen.paint()
          } else if (key.ctrl && key.name === "c") done(CANCEL)
          return
        }
        const before = nameField.value
        const action = form.key(key)
        if (action === "cancel") return done(CANCEL)
        if (action === "back") {
          if (current === 0) form.say("ok", "Press ctrl+c to quit without creating anything.")
          else go(current - 1)
          return screen.paint()
        }
        if (action === "submit") {
          if (current === 0) submitBase()
          else if (current === labels.length - 1) finish()
          else submitStep()
          return screen.paint()
        }
        if (nameField.value !== before) state.wipe = false
        screen.paint()
      },
    })
  })
}

/** "✓ ./my-app is free to use" — what the name means on disk. */
export function describeName(cwd: string, value: string): { tone: "ok" | "warn" | "error"; message: string } {
  if (!value.trim()) return { tone: "error", message: "Give your kit a name" }
  const dir = resolve(cwd, value)
  const slug = toSlug(basename(dir))
  if (!slug || !isValidPackageName(slug)) return { tone: "error", message: "Use letters, numbers and dashes" }
  const shown = `./${relative(cwd, dir) || "."}`
  const pkg = slug !== basename(dir) ? ` · package "${slug}"` : ""
  if (!existsSync(dir)) return { tone: "ok", message: `${shown} is free to use${pkg}` }
  if (isEmptyDir(dir)) return { tone: "ok", message: `${shown} exists and is empty — good to go${pkg}` }
  return { tone: "warn", message: `${shown} isn't empty — klin will ask before sweeping it${pkg}` }
}

/* ─── Build progress ────────────────────────────────────────────────────── */

/**
 * Turns the wizard's last page into a live checklist while the project is
 * built. Returns a task reporter for `task()` and a `stop()` to clean up.
 */
export function buildProgress(options: { heading: string; subtitle: string; plan: string[]; labels: string[] }) {
  const field: ProgressField = { kind: "progress", id: "progress", rows: options.plan.map((title) => ({ status: "pending", title })) }
  const page: Page = {
    version: `v${VERSION}`,
    steps: { labels: options.labels, current: options.labels.length - 1 },
    heading: options.heading,
    subtitle: options.subtitle,
    fields: [field],
    keys: [["ctrl+c", "stop"]],
    help: { title: "Hang tight", text: "Installing can take a minute the first time; later installs reuse the package cache." },
  }
  const form = new Form(page)
  screen.present({
    render: (w, h) => form.render(w, h),
    key: (key) => {
      if (key.ctrl && key.name === "c") {
        screen.close()
        process.exit(130)
      }
    },
  })
  const ticker = setInterval(() => screen.paint(), 120)
  let next = 0

  const reporter: TaskReporter = async (title, fn, opts) => {
    let row = field.rows[next]
    if (!row || row.status !== "pending") {
      row = { status: "pending", title }
      field.rows.push(row)
    }
    next = field.rows.indexOf(row) + 1
    row.title = title
    row.status = "running"
    const started = Date.now()
    const elapsed = () => `${((Date.now() - started) / 1000).toFixed(1)}s`
    const timer = setInterval(() => {
      row!.time = elapsed()
    }, 100)
    let quip: ReturnType<typeof setInterval> | undefined
    if (opts.quips) quip = setInterval(() => (row!.detail = `· ${opts.quips![Math.floor(Math.random() * opts.quips!.length)]}`), 2800)
    try {
      const result = await fn((message) => {
        row!.detail = message
      })
      row.status = "done"
      row.title = opts.done ? opts.done(result) : title
      row.detail = undefined
      return result
    } catch (error) {
      row.status = "failed"
      throw error
    } finally {
      clearInterval(timer)
      if (quip) clearInterval(quip)
      row.time = elapsed()
      screen.paint()
    }
  }

  return {
    reporter,
    /** Drops steps that turned out not to run (e.g. git isn't installed). */
    skip(title: string) {
      const index = field.rows.findIndex((r) => r.title === title && r.status === "pending")
      if (index >= 0) field.rows.splice(index, 1)
    },
    /** Leaves the progress screen; later tasks report as plain lines. */
    stop() {
      clearInterval(ticker)
      setTaskReporter(undefined)
      screen.close()
    },
  }
}
