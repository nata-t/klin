//? "use client" // klin:only next
//? // klin:only next
import { getRouteApi } from "@tanstack/react-router" // klin:only vite
//? import { useRouter, useSearchParams } from "next/navigation" // klin:only next
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, StickyNoteIcon } from "lucide-react"
import { useEffect, useState } from "react" // klin:only vite
//? import { useCallback, useEffect, useState } from "react" // klin:only next
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
//? import { z } from "zod" // klin:only next
import { useNotes } from "./api"
import { NoteCard } from "./note-card"
import { NoteForm } from "./note-form"

// klin:if next
//? /** The filters live in the URL: /notes?page=2&search=milk&pinned=true */
//? const searchSchema = z.object({
//?   page: z.coerce.number().int().min(1).catch(1),
//?   search: z.string().optional().catch(undefined),
//?   pinned: z.stringbool().optional().catch(undefined),
//? })
//?
//? type NotesSearch = z.infer<typeof searchSchema>
// klin:else
const route = getRouteApi("/_app/notes")
// klin:endif

export function NotesPage() {
  // klin:if next
  //? const router = useRouter()
  //? const searchParams = useSearchParams()
  //? const search = searchSchema.parse(Object.fromEntries(searchParams))
  //?
  //? /** Changes some of the filters, keeping the rest — a new history entry, like a link. */
  //? const setSearch = useCallback(
  //?   (patch: Partial<NotesSearch>) => {
  //?     const next = { ...searchSchema.parse(Object.fromEntries(searchParams)), ...patch }
  //?     const params = new URLSearchParams()
  //?     if (next.page > 1) params.set("page", String(next.page))
  //?     if (next.search) params.set("search", next.search)
  //?     if (next.pinned) params.set("pinned", "true")
  //?     router.push(params.size ? `/notes?${params}` : "/notes", { scroll: false })
  //?   },
  //?   [router, searchParams]
  //? )
  // klin:else
  const search = route.useSearch()
  const navigate = route.useNavigate()
  // klin:endif
  const [creating, setCreating] = useState(false)
  const [searchInput, setSearchInput] = useState(search.search ?? "")

  // Filters live in the URL (shareable, back-button friendly) and become the query key.
  const query = { page: search.page, limit: 12, search: search.search, pinned: search.pinned }
  const { data, isPending, isPlaceholderData } = useNotes(query)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== (search.search ?? "")) {
        void navigate({ search: (prev) => ({ ...prev, search: searchInput || undefined, page: 1 }) }) // klin:only vite
        //? setSearch({ search: searchInput || undefined, page: 1 }) // klin:only next
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput, search.search, navigate]) // klin:only vite
  //? }, [searchInput, search.search, setSearch]) // klin:only next

  const pagination = data?.pagination

  return (
    <>
      <PageHeader
        title="Notes"
        description="An example resource, wired from database to UI. Generate your own with `klin generate resource`."
        actions={
          <Dialog open={creating} onOpenChange={setCreating}>
            <DialogTrigger render={<Button />}>
              <PlusIcon /> New note
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New note</DialogTitle>
                <DialogDescription>Notes are private to your account.</DialogDescription>
              </DialogHeader>
              <NoteForm onDone={() => setCreating(false)} />
            </DialogContent>
          </Dialog>
        }
      />

      <div className="flex flex-wrap items-center gap-3">
        <InputGroup className="max-w-xs">
          <InputGroupAddon>
            <SearchIcon />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search notes…"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </InputGroup>
        <Tabs
          value={search.pinned ? "pinned" : "all"}
          onValueChange={(value) =>
            void navigate({ search: (prev) => ({ ...prev, pinned: value === "pinned" || undefined, page: 1 }) }) // klin:only vite
            //? setSearch({ pinned: value === "pinned" || undefined, page: 1 }) // klin:only next
          }
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pinned">Pinned</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-36 rounded-xl" />
          ))}
        </div>
      ) : data && data.items.length > 0 ? (
        <div className={`grid gap-4 transition-opacity sm:grid-cols-2 lg:grid-cols-3 ${isPlaceholderData ? "opacity-60" : ""}`}>
          {data.items.map((note) => (
            <NoteCard key={note.id} note={note} />
          ))}
        </div>
      ) : (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <StickyNoteIcon />
            </EmptyMedia>
            <EmptyTitle>{search.search || search.pinned ? "No matching notes" : "No notes yet"}</EmptyTitle>
            <EmptyDescription>
              {search.search || search.pinned
                ? "Try a different search or filter."
                : "Create your first note — it's saved in your database through the API."}
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setCreating(true)}>
              <PlusIcon /> New note
            </Button>
          </EmptyContent>
        </Empty>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            Page {pagination.page} of {pagination.totalPages} · {pagination.total} notes
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page <= 1}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: pagination.page - 1 }) })} // klin:only vite
              //? onClick={() => setSearch({ page: pagination.page - 1 })} // klin:only next
            >
              <ChevronLeftIcon /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: pagination.page + 1 }) })} // klin:only vite
              //? onClick={() => setSearch({ page: pagination.page + 1 })} // klin:only next
            >
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
