import { getRouteApi } from "@tanstack/react-router"
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon, SearchIcon, StickyNoteIcon } from "lucide-react"
import { useEffect, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useNotes } from "./api"
import { NoteCard } from "./note-card"
import { NoteForm } from "./note-form"

const route = getRouteApi("/_app/notes")

export function NotesPage() {
  const search = route.useSearch()
  const navigate = route.useNavigate()
  const [creating, setCreating] = useState(false)
  const [searchInput, setSearchInput] = useState(search.search ?? "")

  // Filters live in the URL (shareable, back-button friendly) and become the query key.
  const query = { page: search.page, limit: 12, search: search.search, pinned: search.pinned }
  const { data, isPending, isPlaceholderData } = useNotes(query)

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== (search.search ?? "")) {
        void navigate({ search: (prev) => ({ ...prev, search: searchInput || undefined, page: 1 }) })
      }
    }, 300)
    return () => clearTimeout(timeout)
  }, [searchInput, search.search, navigate])

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
            void navigate({ search: (prev) => ({ ...prev, pinned: value === "pinned" || undefined, page: 1 }) })
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
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: pagination.page - 1 }) })}
            >
              <ChevronLeftIcon /> Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={pagination.page >= pagination.totalPages}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, page: pagination.page + 1 }) })}
            >
              Next <ChevronRightIcon />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
