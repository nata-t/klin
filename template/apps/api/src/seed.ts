/**
 * Demo data for local development: `pnpm db:seed`
 *
 * Idempotent — safe to run again. Never runs in production.
 */
import { auth } from "@repo/auth"
import { prisma } from "@repo/db"
import { isProduction } from "@repo/env"

const DEMO_USER = {
  name: "Demo User",
  email: "demo@example.com",
  password: "demo-password-123",
}

const DEMO_NOTES = [
  { title: "👋 Welcome to Klin App", content: "This note lives in your database. Edit it, pin it, delete it.", pinned: true },
  { title: "How this page works", content: "Zod schema → Prisma model → Nest module → TanStack Query hook. See packages/docs/add-a-feature.md." },
  { title: "Generate your own", content: "Run `pnpm klin generate resource project`, then `pnpm db:migrate`, and open /project." },
]

async function main() {
  if (isProduction) {
    console.error("Refusing to seed a production database.")
    process.exit(1)
  }

  let user = await prisma.user.findUnique({ where: { email: DEMO_USER.email } })

  if (!user) {
    // klin:if password
    // Going through Better Auth hashes the password exactly like a real sign-up.
    await auth.api.signUpEmail({ body: DEMO_USER })
    // klin:else
    //? await prisma.user.create({
    //?   data: { id: crypto.randomUUID(), name: DEMO_USER.name, email: DEMO_USER.email, emailVerified: true },
    //? })
    // klin:endif
    user = await prisma.user.update({
      where: { email: DEMO_USER.email },
      data: { emailVerified: true, role: "admin" },
    })
    console.info(`✔ Created ${DEMO_USER.email}`)
  } else {
    console.info(`• ${DEMO_USER.email} already exists`)
  }

  const existing = await prisma.note.count({ where: { userId: user.id } })
  if (existing === 0) {
    await prisma.note.createMany({ data: DEMO_NOTES.map((note) => ({ ...note, userId: user.id })) })
    console.info(`✔ Added ${DEMO_NOTES.length} notes`)
  }

  console.info("")
  // klin:if password
  console.info(`  Sign in with ${DEMO_USER.email} / ${DEMO_USER.password} (an admin)`)
  // klin:else
  //? console.info(`  ${DEMO_USER.email} has no password — sign in with a provider using that email.`)
  // klin:endif
  console.info("")
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
