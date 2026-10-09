import * as p from "@clack/prompts"
import { VERSION } from "../context"
import { brand, pc } from "../ui/theme"
import { findProjectRoot, readProject } from "../utils/project"
import { type Flags, guard } from "./flags"

/** `klin` with no arguments inside a project: pick what to do. */
export async function menu(flags: Flags) {
  const root = findProjectRoot()!
  const config = readProject(root)
  p.intro(`${brand(" klin ")} ${pc.dim(`${config.name} · v${VERSION}`)}`)

  const action = guard(
    await p.select({
      message: "What are we tidying up today?",
      options: [
        { value: "generate", label: "Generate a resource", hint: "schema + model + API + hook + page" },
        { value: "add", label: "Add a module", hint: "organizations, email, uploads…" },
        { value: "remove", label: "Remove a module" },
        { value: "doctor", label: "Run a health check", hint: "env, database, versions" },
        { value: "list", label: "List modules" },
      ],
    })
  )

  flags._ = []
  switch (action) {
    case "generate": {
      const { generateCommand } = await import("./generate")
      return generateCommand({ ...flags, _: ["resource"] })
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
