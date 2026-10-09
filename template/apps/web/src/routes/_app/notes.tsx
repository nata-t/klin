import { createFileRoute } from "@tanstack/react-router"
import { z } from "zod"
import { notesQueryOptions } from "@/features/notes/api"
import { NotesPage } from "@/features/notes/notes-page"

const searchSchema = z.object({
  page: z.number().int().min(1).catch(1).default(1),
  search: z.string().optional().catch(undefined),
  pinned: z.boolean().optional().catch(undefined),
})

export const Route = createFileRoute("/_app/notes")({
  validateSearch: searchSchema,
  staticData: { title: "Notes" },
  // Prefetch on navigation (and on link hover) so the page renders with data.
  loaderDeps: ({ search }) => search,
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(
      notesQueryOptions({ page: deps.page, limit: 12, search: deps.search, pinned: deps.pinned })
    ),
  component: NotesPage,
})
