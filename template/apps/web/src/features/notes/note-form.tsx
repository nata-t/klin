import { type CreateNoteInput, createNoteSchema, type Note } from "@repo/validators"
import { AppForm, applyServerErrors, useAppForm } from "@/components/form"
import { FieldGroup } from "@/components/ui/field"
import { useCreateNote, useUpdateNote } from "./api"

/**
 * Create or edit a note. The validator is the exact schema the API uses for
 * POST /api/notes, so a form that passes here won't be rejected there.
 */
export function NoteForm({ note, onDone }: { note?: Note; onDone?: () => void }) {
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()

  const form = useAppForm({
    defaultValues: {
      title: note?.title ?? "",
      content: note?.content ?? "",
      pinned: note?.pinned ?? false,
    } satisfies CreateNoteInput as CreateNoteInput,
    validators: { onDynamic: createNoteSchema },
    onSubmit: async ({ value }) => {
      try {
        if (note) await updateNote.mutateAsync({ id: note.id, ...value })
        else await createNote.mutateAsync(value)
        onDone?.()
      } catch (error) {
        applyServerErrors(form, error)
      }
    },
  })

  return (
    <AppForm form={form}>
      <FieldGroup>
        <form.AppField name="title">
          {(field) => <field.TextField label="Title" placeholder="Something worth remembering" autoFocus />}
        </form.AppField>
        <form.AppField name="content">
          {(field) => <field.TextareaField label="Content" placeholder="Write anything…" rows={6} />}
        </form.AppField>
        <form.AppField name="pinned">
          {(field) => <field.SwitchField label="Pin to top" description="Pinned notes always come first." />}
        </form.AppField>
        <form.AppForm>
          <form.SubmitButton className="self-end">{note ? "Save changes" : "Create note"}</form.SubmitButton>
        </form.AppForm>
      </FieldGroup>
    </AppForm>
  )
}
