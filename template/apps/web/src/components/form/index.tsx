import { createFormHook, revalidateLogic } from "@tanstack/react-form"
import { isApiError } from "@/lib/api-error"
import { fieldContext, formContext } from "./context"
import {
  CheckboxField,
  NumberField,
  PasswordField,
  SelectField,
  SubmitButton,
  SwitchField,
  TextareaField,
  TextField,
} from "./fields"

/**
 * The form pattern: TanStack Form + a Zod schema from @repo/validators +
 * shadcn inputs.
 *
 *   const form = useAppForm({
 *     defaultValues: { title: "", content: "" } satisfies CreateNoteInput,
 *     validators: { onDynamic: createNoteSchema },  // ← the API validates with this too
 *     onSubmit: ({ value }) => createNote.mutateAsync(value),
 *   })
 *
 *   <AppForm form={form}>
 *     <form.AppField name="title">{(f) => <f.TextField label="Title" />}</form.AppField>
 *     <form.AppForm><form.SubmitButton>Save</form.SubmitButton></form.AppForm>
 *   </AppForm>
 *
 * Validation runs on submit, then live on every change once you've tried to submit.
 */
const { useAppForm: useBaseAppForm, withForm } = createFormHook({
  fieldContext,
  formContext,
  fieldComponents: {
    TextField,
    PasswordField,
    TextareaField,
    NumberField,
    CheckboxField,
    SwitchField,
    SelectField,
  },
  formComponents: { SubmitButton },
})

export const formValidationLogic = revalidateLogic({ mode: "submit", modeAfterSubmission: "change" })

export const useAppForm: typeof useBaseAppForm = (options) =>
  useBaseAppForm({ validationLogic: formValidationLogic, ...options })

export { withForm }

type AnyAppForm = ReturnType<typeof useBaseAppForm>

/** A <form> element wired to `form.handleSubmit()`. */
export function AppForm({
  form,
  children,
  className,
}: {
  form: { handleSubmit: () => Promise<void> } | AnyAppForm
  children: React.ReactNode
  className?: string
}) {
  return (
    <form
      noValidate
      className={className}
      onSubmit={(event) => {
        event.preventDefault()
        event.stopPropagation()
        void form.handleSubmit()
      }}
    >
      {children}
    </form>
  )
}

/**
 * Show server-side validation errors (422 VALIDATION_ERROR details) next to
 * the matching inputs. Call it from onSubmit's catch.
 */
export function applyServerErrors(form: FormWithFieldMeta, error: unknown) {
  if (!isApiError(error)) return
  for (const [field, message] of Object.entries(error.fieldErrors)) {
    form.setFieldMeta(field, (meta) => ({
      ...meta,
      isTouched: true,
      errorMap: { ...meta.errorMap, onServer: { message } },
    }))
  }
}

// Field names are only known at runtime here (they come from the server).
interface FormWithFieldMeta {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFieldMeta: (field: any, updater: (meta: any) => any) => void
}
