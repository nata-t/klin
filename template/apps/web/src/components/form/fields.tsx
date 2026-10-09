import { EyeIcon, EyeOffIcon } from "lucide-react"
import { type ComponentProps, type ReactNode, useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useFieldContext, useFormContext } from "./context"

/*
 * Field components for `useAppForm`. Each reads its field from context, so a
 * form field is one line:
 *
 *   <form.AppField name="title">{(field) => <field.TextField label="Title" />}</form.AppField>
 *
 * Errors show after the field is touched or the form is submitted.
 */

interface BaseProps {
  label: ReactNode
  description?: ReactNode
}

function useFieldState() {
  const field = useFieldContext<unknown>()
  const meta = field.state.meta
  const submitted = field.form.state.submissionAttempts > 0
  const invalid = (meta.isTouched || submitted) && !meta.isValid
  return { field, invalid, errors: meta.errors as Array<{ message?: string } | undefined> }
}

type InputProps = Omit<ComponentProps<typeof Input>, "value" | "onChange" | "onBlur" | "name" | "id">

export function TextField({ label, description, ...props }: BaseProps & InputProps) {
  const field = useFieldContext<string>()
  const { invalid, errors } = useFieldState()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

export function PasswordField({
  label,
  description,
  labelAction,
  ...props
}: BaseProps & InputProps & { labelAction?: ReactNode }) {
  const field = useFieldContext<string>()
  const { invalid, errors } = useFieldState()
  const [visible, setVisible] = useState(false)
  return (
    <Field data-invalid={invalid}>
      <div className="flex items-center justify-between gap-2">
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {labelAction}
      </div>
      <div className="relative">
        <Input
          id={field.name}
          name={field.name}
          type={visible ? "text" : "password"}
          value={field.state.value ?? ""}
          onBlur={field.handleBlur}
          onChange={(event) => field.handleChange(event.target.value)}
          aria-invalid={invalid}
          className="pr-9"
          {...props}
        />
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="absolute top-1/2 right-0.5 -translate-y-1/2 text-muted-foreground"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </Button>
      </div>
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

export function TextareaField({
  label,
  description,
  ...props
}: BaseProps & Omit<ComponentProps<typeof Textarea>, "value" | "onChange" | "onBlur" | "name" | "id">) {
  const field = useFieldContext<string>()
  const { invalid, errors } = useFieldState()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Textarea
        id={field.name}
        name={field.name}
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) => field.handleChange(event.target.value)}
        aria-invalid={invalid}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

export function NumberField({ label, description, ...props }: BaseProps & InputProps) {
  const field = useFieldContext<number | undefined>()
  const { invalid, errors } = useFieldState()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Input
        id={field.name}
        name={field.name}
        type="number"
        inputMode="decimal"
        value={field.state.value ?? ""}
        onBlur={field.handleBlur}
        onChange={(event) =>
          field.handleChange(event.target.value === "" ? undefined : event.target.valueAsNumber)
        }
        aria-invalid={invalid}
        {...props}
      />
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

export function CheckboxField({ label, description }: BaseProps) {
  const field = useFieldContext<boolean>()
  const { invalid, errors } = useFieldState()
  return (
    <Field orientation="horizontal" data-invalid={invalid}>
      <Checkbox
        id={field.name}
        name={field.name}
        checked={field.state.value ?? false}
        onCheckedChange={(checked) => field.handleChange(checked === true)}
        aria-invalid={invalid}
      />
      <FieldContent>
        <FieldLabel htmlFor={field.name} className="font-normal">
          {label}
        </FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {invalid && <FieldError errors={errors} />}
      </FieldContent>
    </Field>
  )
}

export function SwitchField({ label, description }: BaseProps) {
  const field = useFieldContext<boolean>()
  const { invalid, errors } = useFieldState()
  return (
    <Field orientation="horizontal" data-invalid={invalid}>
      <FieldContent>
        <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
        {description && <FieldDescription>{description}</FieldDescription>}
        {invalid && <FieldError errors={errors} />}
      </FieldContent>
      <Switch
        id={field.name}
        name={field.name}
        checked={field.state.value ?? false}
        onCheckedChange={(checked) => field.handleChange(checked)}
      />
    </Field>
  )
}

export function SelectField({
  label,
  description,
  options,
  placeholder = "Select…",
}: BaseProps & { options: ReadonlyArray<{ value: string; label: ReactNode }>; placeholder?: string }) {
  const field = useFieldContext<string>()
  const { invalid, errors } = useFieldState()
  return (
    <Field data-invalid={invalid}>
      <FieldLabel htmlFor={field.name}>{label}</FieldLabel>
      <Select
        name={field.name}
        value={field.state.value ?? null}
        onValueChange={(value) => field.handleChange(value as string)}
        items={options}
      >
        <SelectTrigger id={field.name} aria-invalid={invalid} onBlur={field.handleBlur}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {description && <FieldDescription>{description}</FieldDescription>}
      {invalid && <FieldError errors={errors} />}
    </Field>
  )
}

export function SubmitButton({
  children,
  ...props
}: Omit<ComponentProps<typeof Button>, "type">) {
  const form = useFormContext()
  return (
    <form.Subscribe selector={(state) => state.isSubmitting}>
      {(isSubmitting) => (
        <Button type="submit" disabled={isSubmitting || props.disabled} {...props}>
          {isSubmitting && <Spinner />}
          {children}
        </Button>
      )}
    </form.Subscribe>
  )
}
