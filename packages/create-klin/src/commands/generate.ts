import { existsSync, readFileSync } from "node:fs"
import { mkdir, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import * as p from "@clack/prompts"
import {
  type Database,
  type Field,
  FIELD_TYPE_HINTS,
  FIELD_TYPES,
  type FieldType,
  makeNames,
  parseField,
  type ResourceSpec,
  type Scope,
} from "../generators/resource/fields"
import * as t from "../generators/resource/templates"
import { box } from "../ui/box"
import { task } from "../ui/task"
import { accent, brand, gradient, pc, sym } from "../ui/theme"
import { type ChangeKind, fileTree } from "../ui/tree"
import { run } from "../utils/exec"
import { camel } from "../utils/names"
import { pmCommands, rewriteCommand } from "../utils/pm"
import { findProjectRoot, parsePackageManager, readProject } from "../utils/project"
import { bail, type Flags, guard } from "./flags"

interface Edit {
  path: string
  kind: ChangeKind
  content: string
}

export async function generateCommand(flags: Flags) {
  const [kind, ...rest] = flags._
  if (kind && !["resource", "res", "r"].includes(kind)) {
    bail(`Unknown generator "${kind}". Try: klin generate resource <name> [field:type…]`)
  }

  const root = findProjectRoot()
  if (!root) bail("Run this inside a klin project (no klin.json found).")
  const config = readProject(root)
  const enabled = new Set(Object.values(config.answers).flat())
  const interactive = process.stdin.isTTY && !flags.yes

  p.intro(`${brand(" klin generate ")} ${pc.dim("a whole feature, one command")}`)

  /* ─── Name ─────────────────────────────────────────────────────────── */
  let [name, ...fieldSpecs] = rest
  if (!name) {
    if (!interactive) bail("Give the resource a name: klin generate resource project title:string")
    name = guard(
      await p.text({
        message: "What's the resource called? (singular)",
        placeholder: "project",
        validate: (v) => (!v || !/^[a-zA-Z][\w-]*$/.test(v) ? "Use letters, numbers and dashes" : undefined),
      })
    )
  }
  if (!/^[a-zA-Z][\w-]*$/.test(name)) bail(`"${name}" isn't a valid resource name`)
  const names = makeNames(name, flags.plural)

  /* ─── Fields ───────────────────────────────────────────────────────── */
  let fields: Field[]
  try {
    fields = fieldSpecs.map(parseField)
  } catch (error) {
    bail((error as Error).message)
  }
  if (fields.length === 0) {
    if (!interactive) bail("Add at least one field, e.g. name:string budget:int? due:date")
    fields = await askFields()
  }
  const duplicate = fields.find((f, i) => fields.findIndex((g) => g.name === f.name) !== i)
  if (duplicate) bail(`Field "${duplicate.name}" is listed twice`)

  /* ─── Scope ────────────────────────────────────────────────────────── */
  let scope = (flags.scope as Scope | undefined) ?? undefined
  if (scope && !["user", "org", "none"].includes(scope)) bail("--scope must be user, org or none")
  if (scope === "org" && !enabled.has("organizations")) bail("--scope org needs the organizations module (klin add organizations)")
  if (!scope) {
    scope =
      enabled.has("organizations") && interactive
        ? guard(
            await p.select({
              message: `Who owns a ${names.lower}?`,
              options: [
                { value: "user" as const, label: "The user who created it", hint: "private to each person" },
                { value: "org" as const, label: "The active organization", hint: "shared with teammates" },
                { value: "none" as const, label: "Nobody in particular", hint: "every signed-in user sees all" },
              ],
            })
          )
        : "user"
  }

  const spec: ResourceSpec = {
    names,
    fields,
    scope,
    database: config.answers.database as Database,
  }

  /* ─── Plan ─────────────────────────────────────────────────────────── */
  const withApi = flags.api !== false
  const withUi = flags.ui !== false
  const edits: Edit[] = []
  const add = (path: string, content: string) => {
    const exists = existsSync(join(root, path))
    if (exists && !flags.force) bail(`${path} already exists — use --force to overwrite it`)
    edits.push({ path, kind: exists ? "update" : "create", content })
  }

  add(`packages/validators/src/${names.kebab}.ts`, t.validatorsFile(spec))
  insert(edits, root, "packages/validators/src/index.ts", "// klin-anchor:exports", `export * from "./${names.kebab}"`)

  add(`packages/db/prisma/models/${names.kebab}.prisma`, t.prismaFile(spec))
  const relation = `${names.plural.camel} ${names.pascal}[]`
  if (scope === "user") insert(edits, root, "packages/db/prisma/models/auth.prisma", "// klin-anchor:user-relations", relation)
  if (scope === "org") insert(edits, root, "packages/db/prisma/models/auth.prisma", "// klin-anchor:organization-relations", relation)

  if (withApi) {
    const dir = `apps/api/src/modules/${names.plural.kebab}`
    add(`${dir}/${names.plural.kebab}.module.ts`, t.apiModuleFile(spec))
    add(`${dir}/${names.plural.kebab}.controller.ts`, t.apiControllerFile(spec))
    add(`${dir}/${names.plural.kebab}.service.ts`, t.apiServiceFile(spec))
    const appModule = "apps/api/src/app.module.ts"
    insert(edits, root, appModule, "// klin-anchor:module-imports", `import { ${names.plural.pascal}Module } from "./modules/${names.plural.kebab}/${names.plural.kebab}.module"`)
    insert(edits, root, appModule, "// klin-anchor:modules", `${names.plural.pascal}Module,`)
  }

  if (withUi) {
    const dir = `apps/web/src/features/${names.plural.kebab}`
    add(`${dir}/api.ts`, t.webApiFile(spec))
    if (withApi) {
      add(`${dir}/${names.kebab}-form.tsx`, t.webFormFile(spec))
      add(`${dir}/${names.plural.kebab}-page.tsx`, t.webPageFile(spec))
      add(`apps/web/src/routes/_app/${names.plural.kebab}.tsx`, t.webRouteFile(spec))
      const icon = t.iconFor(names.kebab)
      const nav = "apps/web/src/config/nav.ts"
      const navText = currentText(edits, root, nav)
      if (navText !== null && !new RegExp(`\\b${icon}\\b`).test(navText)) insert(edits, root, nav, "// klin-anchor:nav-icons", `${icon},`)
      insert(edits, root, nav, "// klin-anchor:nav", `{ id: "${names.plural.kebab}", title: "${names.plural.title}", to: "/${names.plural.kebab}", icon: ${icon} },`)
    }
  }

  /* ─── Show & write ─────────────────────────────────────────────────── */
  p.log.step(
    `${pc.bold(names.title)} ${pc.dim(`(${fields.map((f) => `${f.name}:${f.type}${f.optional ? "?" : ""}`).join(" ")})`)} ${pc.dim(`· owned by ${scope === "org" ? "organization" : scope}`)}`
  )
  console.log(fileTree(edits.map(({ path, kind }) => ({ path, kind }))))
  console.log()

  if (flags["dry-run"]) {
    p.outro(pc.dim("Dry run — nothing was written."))
    return
  }

  await task("Writing files", async () => {
    for (const edit of edits) {
      await mkdir(dirname(join(root, edit.path)), { recursive: true })
      await writeFile(join(root, edit.path), edit.content)
    }
  }, { done: () => `Wrote ${edits.length} files` })

  // Keep types in sync right away: Prisma client + TanStack route tree.
  const { pm } = parsePackageManager(config.packageManager)
  await task("Regenerating the Prisma client and routes", async () => {
    await run(pm, ["run", "db:generate"], { cwd: root })
    if (withUi && withApi && existsSync(join(root, "apps/web/node_modules"))) {
      const [bin, ...args] = pmCommands(pm).exec("tsr generate").split(" ")
      await run(bin!, args, { cwd: join(root, "apps/web") })
    }
  }, { done: () => "Prisma client and route tree are up to date" }).catch(() => {
    p.log.warn("Couldn't regenerate types automatically — they'll update on the next `dev`.")
  })

  const cmd = (command: string) => pc.bold(rewriteCommand(`pnpm ${command}`, pm))
  const lines = [
    `${accent(sym.arrow)} ${cmd(`db:migrate --name add-${names.plural.kebab}`)}  ${pc.dim("create the table")}`,
    `${accent(sym.arrow)} ${cmd("dev")}  ${pc.dim("then open")} ${pc.cyan(`/${names.plural.kebab}`)}`,
    "",
    `${pc.dim("schema")}   packages/validators/src/${names.kebab}.ts`,
    `${pc.dim("api")}      ${withApi ? `GET/POST /api/${names.plural.kebab} · GET/PATCH/DELETE /api/${names.plural.kebab}/:id` : pc.dim("skipped (--no-api)")}`,
  ]
  if (enabled.has("i18n") && withUi) lines.push(`${pc.dim("i18n")}     add "nav.${names.plural.kebab}" to src/i18n/locales/*.json`)
  console.log(box(lines, { title: `${sym.sparkle} ${names.plural.title} are ready` }))
  p.outro(gradient("One schema, five layers, zero copy-paste."))
}

/** Interactive field builder: name → type → (values) → required? — until an empty name. */
async function askFields(): Promise<Field[]> {
  const fields: Field[] = []
  p.log.info(pc.dim("Add fields one at a time. Leave the name empty when you're done."))
  while (true) {
    const name = guard(
      await p.text({
        message: fields.length ? `Field ${fields.length + 1} name ${pc.dim("(empty to finish)")}` : "First field name",
        placeholder: fields.length ? "" : "name",
        validate: (v) => {
          if (!v) return fields.length ? undefined : "Add at least one field"
          if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(v)) return "Letters and numbers only"
          if (fields.some((f) => f.name === camel(v))) return "You already added that one"
        },
      })
    )
    if (!name) break
    const type = guard(
      await p.select<FieldType>({
        message: `Type of ${pc.cyan(name)}`,
        options: FIELD_TYPES.map((type) => ({ value: type, label: type, hint: FIELD_TYPE_HINTS[type] })),
      })
    )
    let values = ""
    if (type === "enum") {
      values = guard(
        await p.text({
          message: "Allowed values (comma-separated)",
          placeholder: "draft, published",
          validate: (v) => (!v || v.split(",").filter((x) => x.trim()).length < 2 ? "Give at least two values" : undefined),
        })
      ).replace(/\s+/g, "")
    }
    const required =
      type === "boolean"
        ? true
        : guard(await p.confirm({ message: `Is ${pc.cyan(name)} required?`, initialValue: true }))
    try {
      fields.push(parseField(`${name}:${type}${values ? `:${values}` : ""}${required ? "" : "?"}`))
    } catch (error) {
      p.log.error((error as Error).message)
    }
  }
  return fields
}

function currentText(edits: Edit[], root: string, path: string): string | null {
  const pending = [...edits].reverse().find((e) => e.path === path)
  if (pending) return pending.content
  const abs = join(root, path)
  return existsSync(abs) ? readFileSync(abs, "utf8") : null
}

/**
 * Inserts `line` right above `anchor` (matching its indentation). If the
 * anchor was removed, says so and lets the user wire it up by hand.
 */
function insert(edits: Edit[], root: string, path: string, anchor: string, line: string) {
  const text = currentText(edits, root, path)
  if (text === null) {
    p.log.warn(`${path} is missing — add this yourself:\n  ${pc.cyan(line)}`)
    return
  }
  if (text.includes(line)) return
  const lines = text.split("\n")
  // Exact match: "klin-anchor:nav" must not match "klin-anchor:nav-icons".
  const pattern = new RegExp(`${anchor.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![\\w-])`)
  const at = lines.findIndex((l) => pattern.test(l))
  if (at === -1) {
    p.log.warn(`Couldn't find ${pc.dim(anchor)} in ${path} — add this yourself:\n  ${pc.cyan(line)}`)
    return
  }
  const indentation = /^\s*/.exec(lines[at]!)?.[0] ?? ""
  lines.splice(at, 0, `${indentation}${line}`)
  const content = lines.join("\n")
  const existing = edits.find((e) => e.path === path)
  if (existing) existing.content = content
  else edits.push({ path, kind: "update", content })
}
