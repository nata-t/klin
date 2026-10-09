import { Injectable, NotFoundException } from "@nestjs/common"
import type { Prisma } from "@repo/db"
import type { CreateNote, NoteListQuery, UpdateNote } from "@repo/validators"
import { contains, paginate, toSkipTake } from "../../common"
import { PrismaService } from "../../prisma/prisma.service"

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, query: NoteListQuery) {
    const where: Prisma.NoteWhereInput = {
      userId,
      ...(query.pinned !== undefined && { pinned: query.pinned }),
      ...(query.search && {
        OR: [{ title: contains(query.search) }, { content: contains(query.search) }],
      }),
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.note.findMany({
        where,
        orderBy: [{ pinned: "desc" }, { [query.sortBy]: query.sortOrder }],
        ...toSkipTake(query),
      }),
      this.prisma.note.count({ where }),
    ])

    return paginate(items, total, query)
  }

  async get(userId: string, id: string) {
    const note = await this.prisma.note.findFirst({ where: { id, userId } })
    if (!note) throw new NotFoundException("Note not found")
    return note
  }

  create(userId: string, input: CreateNote) {
    return this.prisma.note.create({ data: { ...input, userId } })
  }

  async update(userId: string, id: string, input: UpdateNote) {
    await this.get(userId, id)
    return this.prisma.note.update({ where: { id }, data: input })
  }

  async remove(userId: string, id: string) {
    await this.get(userId, id)
    await this.prisma.note.delete({ where: { id } })
    return { id }
  }
}
