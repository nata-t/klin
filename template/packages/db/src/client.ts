// klin:if sqlite
//? import { env, fromRoot } from "@repo/env"
// klin:else
import { env } from "@repo/env"
// klin:endif
// klin:if postgres
import { PrismaPg } from "@prisma/adapter-pg"
// klin:elif mysql
//? import { PrismaMariaDb } from "@prisma/adapter-mariadb"
// klin:elif sqlite
//? import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3"
// klin:endif
import { PrismaClient } from "./generated/prisma/client"

/**
 * The one PrismaClient for the whole app. Prisma 7 talks to the database
 * through a driver adapter, picked here for your database.
 */
function createAdapter() {
  // klin:if postgres
  return new PrismaPg({ connectionString: env.DATABASE_URL })
  // klin:elif mysql
  //? return new PrismaMariaDb(env.DATABASE_URL)
  // klin:elif sqlite
  //? // Relative file: paths are resolved from the repo root, like prisma.config.ts.
  //? const url = env.DATABASE_URL.startsWith("file:/")
  //?   ? env.DATABASE_URL
  //?   : `file:${fromRoot(env.DATABASE_URL.slice("file:".length))}`
  //? return new PrismaBetterSqlite3({ url })
  // klin:endif
}

export const prisma = new PrismaClient({ adapter: createAdapter() })

export type Database = typeof prisma
