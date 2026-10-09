import { keepPreviousData, queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import type { CreateNoteInput, Note, NoteList, NoteListQuery, UpdateNoteInput } from "@repo/validators"
import { api } from "@/lib/api-client"

/**
 * Query keys for notes. Every key starts with "notes", so one call can
 * invalidate all of them, or just the lists, or a single note:
 *
 *   queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
 */
export const noteKeys = {
  all: ["notes"] as const,
  lists: () => [...noteKeys.all, "list"] as const,
  list: (query: Partial<NoteListQuery>) => [...noteKeys.lists(), query] as const,
  details: () => [...noteKeys.all, "detail"] as const,
  detail: (id: string) => [...noteKeys.details(), id] as const,
}

export const notesQueryOptions = (query: Partial<NoteListQuery> = {}) =>
  queryOptions({
    queryKey: noteKeys.list(query),
    queryFn: ({ signal }) => api.get<NoteList>("/notes", query, signal),
    placeholderData: keepPreviousData,
  })

export const noteQueryOptions = (id: string) =>
  queryOptions({
    queryKey: noteKeys.detail(id),
    queryFn: ({ signal }) => api.get<Note>(`/notes/${id}`, undefined, signal),
  })

export function useNotes(query: Partial<NoteListQuery> = {}) {
  return useQuery(notesQueryOptions(query))
}

export function useNote(id: string) {
  return useQuery(noteQueryOptions(id))
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: CreateNoteInput) => api.post<Note>("/notes", input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.lists() }),
    meta: { successMessage: "Note created" },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...input }: UpdateNoteInput & { id: string }) =>
      api.patch<Note>(`/notes/${id}`, input),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note)
      return queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<{ id: string }>(`/notes/${id}`),
    onSuccess: ({ id }) => {
      queryClient.removeQueries({ queryKey: noteKeys.detail(id) })
      return queryClient.invalidateQueries({ queryKey: noteKeys.lists() })
    },
    meta: { successMessage: "Note deleted" },
  })
}
