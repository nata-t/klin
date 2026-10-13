import { VERSION } from "../context"
import { gradient, pc, sym } from "./theme"

const cmd = (s: string) => pc.cyan(s)
const flag = (s: string) => pc.yellow(s)
const dim = pc.dim

export function help() {
  const title = `${gradient(`${sym.star} klin`)} ${dim(`v${VERSION}`)} ${dim("— a spotless full-stack starter")}`
  console.log(`
  ${title}

  ${pc.bold("Create a project")}
    ${cmd("npm create klin@latest")} ${dim("[name] [options]")}
    ${dim("also:")} ${cmd("pnpm create klin")} ${dim("·")} ${cmd("bun create klin")} ${dim("·")} ${cmd("npx create-klin")}

    ${flag("--preset")} ${dim("<id>")}        recommended · saas · minimal · everything
    ${flag("--backend")} ${dim("<name>")}     nest · plain
    ${flag("--server")} ${dim("<name>")}      express · fastify
    ${flag("--auth")} ${dim("<list>")}        password,google,github,magic-link,two-factor,passkey
    ${flag("--plugins")} ${dim("<list>")}     organizations,admin,api-keys ${dim("(or none)")}
    ${flag("--db")} ${dim("<name>")}          postgres · mysql · sqlite
    ${flag("--security")} ${dim("<list>")}    cors,helmet,rate-limit ${dim("(or none)")}
    ${flag("--extras")} ${dim("<list>")}      email,uploads,queues,i18n,docker,ci ${dim("(or none)")}
    ${flag("--accent")} ${dim("<color>")}     violet · blue · emerald · rose · amber · neutral
    ${flag("--pm")} ${dim("<name>")}          pnpm · bun · npm
    ${flag("--template")} ${dim("<src>")}     ./folder or github:you/your-template[#branch]
    ${flag("-y, --yes")}            accept defaults, no questions
    ${flag("--dry-run")}             show what would be created
    ${flag("--no-install")} ${dim("·")} ${flag("--no-git")} ${dim("·")} ${flag("--force")} ${dim("·")} ${flag("--no-banner")}

  ${pc.bold("Inside a project")} ${dim("(pnpm klin … · npx create-klin …)")}
    ${cmd("klin add")} ${dim("<module…>")}            bolt on a module later      ${dim("klin add organizations email")}
    ${cmd("klin remove")} ${dim("<module…>")}         take one out again
    ${cmd("klin generate resource")} ${dim("<name> [field:type…]")}
                                     schema + model + API + hook + page
                                     ${dim("klin g resource project name:string budget:int? due:date?")}
    ${cmd("klin list")}                     modules and what's switched on
    ${cmd("klin doctor")}                   check env, database, services & versions
    ${cmd("klin upgrade")} ${dim("[--from <dir>]")}   merge template improvements in ${dim("(experimental)")}

  ${dim(`Field types: string text int float boolean date datetime enum:a,b,c — end with ? for optional.
  Docs: packages/docs in your project · https://github.com/klin-dev/klin`)}
`)
}
