import { VERSION } from "../context"
import { intro } from "../ui/log"
import * as prompts from "../ui/prompts"
import { c } from "../ui/theme"
import { findProjectRoot, readProject } from "../utils/project"
import { type Flags, guard } from "./flags"

/** `klin` with no arguments inside a project: pick what to do. */
export async function menu(flags: Flags) {
  const root = findProjectRoot()!
  const config = readProject(root)
  intro("klin", c.dim(`${config.name} · v${VERSION}`))
  prompts.setPromptContext(`klin · ${config.name}`)

  const action = guard(
    await prompts.select({
      message: "What are we tidying up today?",
      subtitle: config.name,
      title: "Commands",
      options: [
        { value: "generate", label: "Generate code", about: "A full-stack resource, a backend module or a frontend feature: the files and the wiring, ready for you to fill in." },
        { value: "add", label: "Add a module", about: "Bolt on organizations, email, uploads, a different database… klin merges it into your code." },
        { value: "remove", label: "Remove a module", about: "Take a module out again. Files you edited are kept and listed." },
        { value: "doctor", label: "Run a health check", about: "Checks Node, your package manager, .env, the database and services, and drifting versions." },
        { value: "list", label: "List modules", about: "Every module the template offers, and which ones this project has on." },
      ],
    })
  )

  flags._ = []
  switch (action) {
    case "generate": {
      const { generateCommand } = await import("./generate")
      return generateCommand(flags)
    }
    case "add":
    case "remove": {
      const { addCommand, removeCommand } = await import("./transition")
      return action === "add" ? addCommand(flags) : removeCommand(flags)
    }
    case "doctor": {
      const { doctorCommand } = await import("./doctor")
      return doctorCommand(flags)
    }
    case "list": {
      const { listCommand } = await import("./list")
      return listCommand(flags)
    }
  }
}
