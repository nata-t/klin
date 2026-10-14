import { VERSION } from "../context"
import { c, shimmer, sym } from "./theme"

const cmd = (s: string) => c.white(s)
const flag = (s: string) => c.bright(s)
const dim = c.dim

export function help() {
  const title = `${shimmer(`${sym.star} klin`)} ${dim(`v${VERSION}`)} ${dim("— a spotless full-stack starter")}`
  console.log(`
  ${title}

  ${c.bold("Create a project")}
    ${cmd("npm create klin@latest")} ${dim("[name] [options]")}
    ${dim("also:")} ${cmd("pnpm create klin")} ${dim("·")} ${cmd("bun create klin")} ${dim("·")} ${cmd("npx create-klin")}

    ${flag("--preset")} ${dim("<id>")}        recommended · saas · minimal · everything
    ${flag("--backend")} ${dim("<name>")}     nest · plain
    ${flag("--server")} ${dim("<name>")}      express · fastify
    ${flag("--db")} ${dim("<name>")}          postgres · mysql · sqlite
    ${flag("--web")} ${dim("<name>")}         vite · next ${dim("(picked once, at create)")}
    ${flag("--auth")} ${dim("<list>")}        password,google,github,magic-link,two-factor,passkey
    ${flag("--plugins")} ${dim("<list>")}     organizations,admin,api-keys ${dim("(or none)")}
    ${flag("--security")} ${dim("<list>")}    cors,helmet,rate-limit ${dim("(or none)")}
    ${flag("--extras")} ${dim("<list>")}      email,uploads,queues,i18n,docker,ci ${dim("(or none)")}
    ${flag("--components")} ${dim("<where>")} apps-web · packages-ui
    ${flag("--accent")} ${dim("<color>")}     neutral · amber · blue · cyan · emerald · fuchsia · green · indigo · lime
                         orange · pink · purple · red · rose · sky · teal · violet · yellow
    ${flag("--pm")} ${dim("<name>")}          bun ${dim("(default)")} · pnpm · npm
    ${flag("--template")} ${dim("<src>")}     ./folder or github:you/your-template[#branch]
    ${flag("-y, --yes")}            accept defaults, no questions
    ${flag("--dry-run")}             show what would be created
    ${flag("--no-install")} ${dim("·")} ${flag("--no-git")} ${dim("·")} ${flag("--force")} ${dim("·")} ${flag("--no-banner")}

  ${c.bold("Inside a project")} ${dim("(pnpm klin … · npx create-klin …)")}
    ${cmd("klin add")} ${dim("<module…>")}            bolt on a module later      ${dim("klin add organizations email")}
    ${cmd("klin remove")} ${dim("<module…>")}         take one out again
    ${cmd("klin generate")}                 pick what to make, then name it
    ${cmd("klin generate resource")} ${dim("<name>")} model + schemas + API + page
    ${cmd("klin generate backend")} ${dim("<name>")}  controller, service, DTOs, module
    ${cmd("klin generate frontend")} ${dim("<name>")} page, route, query hooks, form
                                  ${dim("slashes make folders: klin g resource blog/post · aliases r, b, f")}
        ${flag("--url")} ${dim("<path>")}              serve on /api/<path> and /<path> instead of the folders
        ${flag("--plural")} ${dim("<word>")}           when the guessed plural is wrong ${dim("(criterion → criteria)")}
        ${flag("--no-model")}                skip the Prisma model ${dim("(the service is left to fill in)")}
        ${flag("--no-validation")}           skip packages/validators ${dim("(the schemas already exist)")}
        ${flag("--no-route")} ${dim("·")} ${flag("--no-nav")}     skip the page's route ${dim("·")} skip the sidebar entry
        ${flag("--dry-run")} ${dim("·")} ${flag("--force")}       show the plan only ${dim("·")} overwrite generated files
        ${flag("--backend-dir")} ${dim("<dir>")}       put this run's files in another folder ${dim("(inside apps/api/src)")}
        ${flag("--frontend-dir")} ${dim("<dir>")}      ${dim("… inside apps/web/src, not routes/")}
        ${flag("--validation-dir")} ${dim("<dir>")}    ${dim("… inside packages/validators/src")}
        ${flag("--model-dir")} ${dim("<dir>")}         ${dim("… inside packages/db/prisma, not migrations/")}
    ${cmd("klin generate paths")}           the default folders ${dim("· set with --…-dir · --reset for klin's")}
    ${cmd("klin list")}                     modules and what's switched on
    ${cmd("klin doctor")}                   check env, database, services & versions
    ${cmd("klin upgrade")} ${dim("[--from <dir>]")}   merge template improvements in ${dim("(experimental)")}

  ${dim(`Generated code has the schemas, endpoints and wiring; you add the fields and the logic.
  Docs: packages/docs in your project · https://github.com/klin-dev/klin`)}
`)
}
