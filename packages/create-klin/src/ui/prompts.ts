import { VERSION } from "../context"
import { type ChipItem, type Field, Form, type InputField, type Page, type Tone } from "./form"
import { screen } from "./term"
import { c, parseColor, sym } from "./theme"

/**
 * One-question prompts on the full-screen UI (used by add/remove/generate and
 * the menu). Each answer is echoed to the scrollback as `◆ question  answer`
 * once the screen closes.
 */

export const CANCEL = Symbol("cancel")
export type Cancel = typeof CANCEL
export const isCancel = (value: unknown): value is Cancel => value === CANCEL

let context = "klin"

/** Shown next to the KLIN logo ("klin add · my-app"). */
export function setPromptContext(text: string) {
  context = text
}

export interface Option<T extends string> {
  value: T
  label: string
  hint?: string
  about?: string
  swatch?: string
  disabled?: string
  /** Options with the same group are shown together under that title. */
  group?: string
}

function ask<T>(form: Form, onAction: (action: ReturnType<Form["key"]>, finish: (value: T | Cancel) => void) => void) {
  return new Promise<T | Cancel>((resolve) => {
    screen.present({
      render: (w, h) => form.render(w, h),
      key: (key) => {
        const action = form.key(key)
        if (action === "cancel") return resolve(CANCEL)
        onAction(action, resolve)
        screen.paint()
      },
    })
  })
}

const echo = (message: string, answer: string) => screen.remember(`${c.faint("│")}\n${c.bright(sym.diamond)}  ${message}  ${c.muted(answer)}`)

const toItems = <T extends string>(options: Option<T>[]): ChipItem[] =>
  options.map((o) => ({
    id: o.value,
    label: o.label,
    about: o.about ?? o.hint,
    swatch: o.swatch ? parseColor(o.swatch) : undefined,
    disabled: o.disabled,
  }))

function page(message: string, subtitle: string | undefined, fields: Field[], keys: Page["keys"]): Page {
  return { title: context, version: `v${VERSION}`, heading: message, subtitle, fields, keys }
}

export async function select<T extends string>(options: {
  message: string
  subtitle?: string
  title?: string
  options: Option<T>[]
  initialValue?: T
}): Promise<T | Cancel> {
  let value = options.initialValue ?? options.options.find((o) => !o.disabled)?.value
  const field: Field = {
    kind: "chips",
    id: "select",
    title: options.title ?? "Pick one",
    multi: false,
    items: toItems(options.options),
    isOn: (id) => id === value,
    toggle: (id) => {
      value = id as T
    },
  }
  const p = page(options.message, options.subtitle, [field], [
    ["←→", "move"],
    ["enter", "choose"],
    ["esc", "cancel"],
  ])
  const form = new Form(p)
  const index = options.options.findIndex((o) => o.value === value)
  form.cursor.item = Math.max(0, index)
  const result = await ask<T>(form, (action, finish) => {
    if (action === "back") return finish(CANCEL)
    if (action !== "submit") return
    const item = options.options[form.cursor.item]
    if (!item || item.disabled) return form.say("warn", item?.disabled ?? "Pick something first")
    value = item.value
    finish(item.value)
  })
  if (!isCancel(result)) echo(options.message, options.options.find((o) => o.value === result)?.label ?? result)
  return result
}

export async function multiselect<T extends string>(options: {
  message: string
  subtitle?: string
  title?: string
  options: Option<T>[]
  initialValues?: T[]
  required?: boolean
}): Promise<T[] | Cancel> {
  const picked = new Set<string>(options.initialValues ?? [])
  const groups = [...new Set(options.options.map((o) => o.group ?? options.title ?? "Pick any"))]
  const fields: Field[] = groups.map((group) => ({
    kind: "chips",
    id: `multiselect:${group}`,
    title: group,
    multi: true,
    items: toItems(options.options.filter((o) => (o.group ?? options.title ?? "Pick any") === group)),
    isOn: (id) => picked.has(id),
    toggle: (id) => {
      if (picked.has(id)) picked.delete(id)
      else picked.add(id)
    },
  }))
  const p = page(options.message, options.subtitle, fields, [
    ["space", "snap"],
    ["←↑↓→", "move"],
    ["enter", "done"],
    ["esc", "cancel"],
  ])
  const form = new Form(p)
  const result = await ask<T[]>(form, (action, finish) => {
    if (action === "back") return finish(CANCEL)
    if (action !== "submit") return
    if (options.required && picked.size === 0) return form.say("error", "Snap on at least one — space toggles the highlighted chip.")
    finish(options.options.map((o) => o.value).filter((v) => picked.has(v)))
  })
  if (!isCancel(result)) echo(options.message, result.map((v) => options.options.find((o) => o.value === v)?.label ?? v).join(", ") || "none")
  return result
}

export async function text(options: {
  message: string
  subtitle?: string
  label?: string
  hint?: string
  placeholder?: string
  initialValue?: string
  defaultValue?: string
  about?: string
  validate?: (value: string) => string | undefined
  /** What a valid value means, e.g. "./my-app is free to use". */
  describe?: (value: string) => { tone: Tone; message: string } | undefined
}): Promise<string | Cancel> {
  const input: InputField = {
    kind: "input",
    id: "text",
    label: options.label ?? options.message,
    hint: options.hint,
    about: options.about,
    placeholder: options.placeholder,
    value: options.initialValue ?? "",
    caret: (options.initialValue ?? "").length,
    validate: (value) => {
      const effective = value || options.defaultValue || ""
      const error = options.validate?.(effective)
      if (error) return { tone: "error", message: error }
      return options.describe?.(effective) ?? { tone: "ok", message: effective ? "Looks good" : "Press enter to continue" }
    },
  }
  const p = page(options.message, options.subtitle, [input], [
    ["type", "edit"],
    ["enter", "next"],
    ["esc", "cancel"],
  ])
  const form = new Form(p)
  const result = await ask<string>(form, (action, finish) => {
    if (action === "back") return finish(CANCEL)
    if (action !== "submit") return
    const value = input.value || options.defaultValue || ""
    const error = options.validate?.(value)
    if (error) return form.say("error", error)
    finish(value)
  })
  if (!isCancel(result)) echo(options.message, result || c.dim("(empty)"))
  return result
}

export async function confirm(options: { message: string; subtitle?: string; initialValue?: boolean; yes?: string; no?: string }): Promise<boolean | Cancel> {
  const choices: Option<"yes" | "no">[] = [
    { value: "yes", label: options.yes ?? "Yes" },
    { value: "no", label: options.no ?? "No" },
  ]
  let value: "yes" | "no" = options.initialValue === false ? "no" : "yes"
  const field: Field = {
    kind: "chips",
    id: "confirm",
    title: "Your call",
    multi: false,
    items: toItems(choices),
    isOn: (id) => id === value,
    toggle: (id) => {
      value = id as "yes" | "no"
    },
  }
  const p = page(options.message, options.subtitle, [field], [
    ["y", options.yes ?? "yes"],
    ["n", options.no ?? "no"],
    ["enter", "choose"],
  ])
  const form = new Form(p)
  form.cursor.item = value === "yes" ? 0 : 1
  const result = await new Promise<boolean | Cancel>((resolve) => {
    screen.present({
      render: (w, h) => form.render(w, h),
      key: (key) => {
        if (key.name === "y") return resolve(true)
        if (key.name === "n") return resolve(false)
        const action = form.key(key)
        if (action === "cancel" || action === "back") return resolve(CANCEL)
        if (action === "submit") return resolve(form.cursor.item === 0)
        screen.paint()
      },
    })
  })
  if (!isCancel(result)) echo(options.message, result ? (options.yes ?? "Yes") : (options.no ?? "No"))
  return result
}
