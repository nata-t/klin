import { type Prisma, prisma } from "@repo/db"
import type { CreateNote, NoteListQuery, UpdateNote } from "@repo/validators"
import { notFound } from "../lib/http"
import { contains, paginate, toSkipTake } from "../lib/pagination"

/**
 * Notes — plain functions over Prisma. Routes validate the input with the
 * shared schemas first, so these receive clean, typed data (z.infer types).
 * Every query is scoped to the signed-in user.
 */

export async function listNotes(userId: string, query: NoteListQuery) {
  const where: Prisma.NoteWhereInput = {
    userId,
    ...(query.pinned !== undefined && { pinned: query.pinned }),
    ...(query.search && {
      OR: [{ title: contains(query.search) }, { content: contains(query.search) }],
    }),
  }

  const [items, total] = await prisma.$transaction([
    prisma.note.findMany({
      where,
      orderBy: [{ pinned: "desc" }, { [query.sortBy]: query.sortOrder }],
      ...toSkipTake(query),
    }),
    prisma.note.count({ where }),
  ])

  return paginate(items, total, query)
}

export async function getNote(userId: string, id: string) {
  const note = await prisma.note.findFirst({ where: { id, userId } })
  if (!note) throw notFound("Note not found")
  return note
}

export function createNote(userId: string, input: CreateNote) {
  return prisma.note.create({ data: { ...input, userId } })
}

export async function updateNote(userId: string, id: string, input: UpdateNote) {
  await getNote(userId, id)
  return prisma.note.update({ where: { id }, data: input })
}

export async function deleteNote(userId: string, id: string) {
  await getNote(userId, id)
  await prisma.note.delete({ where: { id } })
  return { id }
}
