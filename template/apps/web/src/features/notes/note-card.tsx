import type { Note } from "@repo/validators"
import { MoreHorizontalIcon, PencilIcon, PinIcon, PinOffIcon, TrashIcon } from "lucide-react"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { Card, CardAction, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import { useDeleteNote, useUpdateNote } from "./api"
import { NoteForm } from "./note-form"

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" })

export function NoteCard({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()

  return (
    <>
      <Card className={cn("group transition-shadow hover:shadow-md", note.pinned && "ring-1 ring-brand/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {note.pinned && <PinIcon className="size-3.5 shrink-0 text-brand" />}
            <span className="line-clamp-1">{note.title}</span>
          </CardTitle>
          <CardDescription className="line-clamp-3 min-h-[3lh] whitespace-pre-line">
            {note.content || <span className="italic">No content</span>}
          </CardDescription>
          <p className="text-xs text-muted-foreground">Updated {dateFormat.format(new Date(note.updatedAt))}</p>
          <CardAction>
            <DropdownMenu>
              <DropdownMenuTrigger render={<Button variant="ghost" size="icon-sm" aria-label="Note actions" />}>
                <MoreHorizontalIcon />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon /> Edit
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => updateNote.mutate({ id: note.id, pinned: !note.pinned })}>
                  {note.pinned ? <PinOffIcon /> : <PinIcon />} {note.pinned ? "Unpin" : "Pin"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <TrashIcon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardAction>
        </CardHeader>
      </Card>

      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit note</DialogTitle>
          </DialogHeader>
          <NoteForm note={note} onDone={() => setEditing(false)} />
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{note.title}”?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteNote.isPending}
              onClick={() => deleteNote.mutate(note.id, { onSuccess: () => setConfirmDelete(false) })}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
