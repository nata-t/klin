import { type CreateOrganizationInput, createOrganizationSchema } from "@repo/validators"
import { AppForm, useAppForm } from "@/components/form"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FieldGroup } from "@/components/ui/field"
import { useCreateOrganization } from "./api"

const toSlug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)

export function CreateOrganizationDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const createOrganization = useCreateOrganization()
  const form = useAppForm({
    defaultValues: { name: "", slug: "" } satisfies CreateOrganizationInput as CreateOrganizationInput,
    validators: { onDynamic: createOrganizationSchema },
    onSubmit: async ({ value, formApi }) => {
      await createOrganization.mutateAsync(value)
      formApi.reset()
      onOpenChange(false)
    },
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create an organization</DialogTitle>
          <DialogDescription>A shared workspace for your team. You'll be its owner.</DialogDescription>
        </DialogHeader>
        <AppForm form={form}>
          <FieldGroup>
            <form.AppField
              name="name"
              listeners={{
                onChange: ({ value }) => {
                  if (!form.getFieldMeta("slug")?.isDirty) form.setFieldValue("slug", toSlug(value), { dontUpdateMeta: true })
                },
              }}
            >
              {(field) => <field.TextField label="Name" placeholder="Acme Inc." autoFocus />}
            </form.AppField>
            <form.AppField name="slug">
              {(field) => <field.TextField label="URL slug" placeholder="acme" description="Lowercase letters, numbers and dashes." />}
            </form.AppField>
            <form.AppForm>
              <form.SubmitButton className="self-end">Create organization</form.SubmitButton>
            </form.AppForm>
          </FieldGroup>
        </AppForm>
      </DialogContent>
    </Dialog>
  )
}
