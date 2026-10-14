/**
 * The fields in the "one schema" demo. `name` is the example field
 * `klin generate resource billing/invoice` writes (copied from the generated
 * file); the others are the kind of fields you'd add next to it.
 */

export interface DemoField {
  id: string
  always?: boolean
  /** The line in `invoiceFields` (what clients send). */
  zod: string
  /** The line in `invoiceSchema` (what the API returns). */
  response: string
  /** The field in z.input<typeof createInvoiceSchema>. */
  type: string
  input: { kind: "text" | "number" | "date" | "select"; options?: string[] }
  label: string
  initial: string
  /** The same rule the schema line states, with its message. */
  check(value: string): string | null
  /** The value the form sends. */
  json(value: string): unknown
}

export const FIELDS: DemoField[] = [
  {
    id: "name",
    always: true,
    zod: `name: z.string().trim().min(1, "Name is required").max(120, "Keep it under 120 characters"),`,
    response: "name: z.string(),",
    type: "name: string",
    input: { kind: "text" },
    label: "Name",
    initial: "Acme Studio",
    check: (v) => (!v.trim() ? "Name is required" : v.trim().length > 120 ? "Keep it under 120 characters" : null),
    json: (v) => v.trim(),
  },
  {
    id: "amount",
    zod: `amount: z.number().positive("Must be more than 0"),`,
    response: "amount: z.number(),",
    type: "amount: number",
    input: { kind: "number" },
    label: "Amount",
    initial: "1200",
    check: (v) => (v.trim() !== "" && Number(v) > 0 ? null : "Must be more than 0"),
    json: (v) => (v.trim() === "" ? null : Number(v)),
  },
  {
    id: "dueDate",
    zod: `dueDate: z.iso.date("Pick a due date"),`,
    response: "dueDate: z.string(),",
    type: "dueDate: string",
    input: { kind: "date" },
    label: "Due date",
    initial: "2026-11-30",
    check: (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? null : "Pick a due date"),
    json: (v) => v,
  },
  {
    id: "status",
    zod: `status: z.enum(["draft", "sent", "paid"]).default("draft"),`,
    response: `status: z.enum(["draft", "sent", "paid"]),`,
    type: `status?: "draft" | "sent" | "paid"`,
    input: { kind: "select", options: ["draft", "sent", "paid"] },
    label: "Status",
    initial: "draft",
    check: () => null,
    json: (v) => v,
  },
  {
    id: "notes",
    zod: `notes: z.string().max(500, "Keep it under 500 characters").optional(),`,
    response: "notes: z.string().optional(),",
    type: "notes?: string",
    input: { kind: "text" },
    label: "Notes",
    initial: "",
    check: (v) => (v.length > 500 ? "Keep it under 500 characters" : null),
    json: (v) => (v === "" ? undefined : v),
  },
]
