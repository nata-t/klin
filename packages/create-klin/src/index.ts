#!/usr/bin/env node
import { basename } from "node:path"
import mri from "mri"
import * as p from "@clack/prompts"
import { create } from "./commands/create"
import { FLAG_SPEC, type Flags } from "./commands/flags"
import { VERSION } from "./context"
import { help } from "./ui/help"
import { pc } from "./ui/theme"
import { findProjectRoot } from "./utils/project"

const COMMANDS = {
  add: () => import("./commands/transition").then((m) => m.addCommand),
  remove: () => import("./commands/transition").then((m) => m.removeCommand),
  rm: () => import("./commands/transition").then((m) => m.removeCommand),
  upgrade: () => import("./commands/transition").then((m) => m.upgradeCommand),
  generate: () => import("./commands/generate").then((m) => m.generateCommand),
  g: () => import("./commands/generate").then((m) => m.generateCommand),
  gen: () => import("./commands/generate").then((m) => m.generateCommand),
  doctor: () => import("./commands/doctor").then((m) => m.doctorCommand),
  list: () => import("./commands/list").then((m) => m.listCommand),
  ls: () => import("./commands/list").then((m) => m.listCommand),
} satisfies Record<string, () => Promise<(flags: Flags) => Promise<void>>>

async function main() {
  const flags = mri<Flags>(process.argv.slice(2), FLAG_SPEC) as Flags
  flags._ = flags._.map(String)

  if (flags.version) {
    console.log(VERSION)
    return
  }
  if (flags.help || flags._[0] === "help") {
    help()
    return
  }

  const [command] = flags._
  if (command && command in COMMANDS) {
    flags._ = flags._.slice(1)
    const run = await COMMANDS[command as keyof typeof COMMANDS]()
    await run(flags)
    return
  }

  // `klin` with no arguments inside a project → the command menu.
  const invokedAsKlin = basename(process.argv[1] ?? "").startsWith("klin")
  if (!command && invokedAsKlin && findProjectRoot()) {
    const { menu } = await import("./commands/menu")
    await menu(flags)
    return
  }

  await create(flags)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  p.cancel(pc.red(message))
  if (process.env.KLIN_DEBUG && error instanceof Error) console.error(error.stack)
  process.exit(1)
})
