import { describe, expect, it } from "vitest"
import {
  createNoteSchema,
  noteListQuerySchema,
  noteSchema,
  updateNoteSchema,
} from "./note"

describe("note schemas", () => {
  it("fills defaults on create", () => {
    expect(createNoteSchema.parse({ title: "  Groceries " })).toEqual({
      title: "Groceries",
      content: "",
      pinned: false,
    })
  })

  it("rejects an empty title with a friendly message", () => {
    const result = createNoteSchema.safeParse({ title: "   " })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.message).toBe("Give your note a title")
  })

  it("keeps PATCH partial — omitted fields stay omitted", () => {
    expect(updateNoteSchema.parse({ pinned: true })).toEqual({ pinned: true })
  })

  it("coerces list query strings", () => {
    expect(
      noteListQuerySchema.parse({ page: "2", limit: "5", pinned: "true" })
    ).toMatchObject({ page: 2, limit: 5, pinned: true, sortBy: "createdAt" })
  })

  it("serializes Prisma dates to ISO strings and strips private fields", () => {
    const now = new Date("2026-01-01T00:00:00.000Z")
    const wire = noteSchema.parse({
      id: "n1",
      title: "Hello",
      content: "",
      pinned: false,
      createdAt: now,
      updatedAt: now,
      userId: "secret-owner-id",
    })
    expect(wire.createdAt).toBe("2026-01-01T00:00:00.000Z")
    expect(wire).not.toHaveProperty("userId")
  })
})
