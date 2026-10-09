import { prisma, type Database } from "@repo/db"

/**
 * Inject this anywhere to talk to the database:
 *
 *   constructor(private readonly prisma: PrismaService) {}
 *   this.prisma.note.findMany()
 *
 * It *is* the shared PrismaClient from @repo/db (one connection pool for the
 * app); the class only exists so Nest has a token to inject.
 */
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging, @typescript-eslint/no-empty-object-type
export interface PrismaService extends Database {}
// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export abstract class PrismaService {}

export const prismaProvider = { provide: PrismaService, useValue: prisma }
