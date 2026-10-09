import { env } from "@repo/env"
import { render } from "@react-email/render"
import type { ReactElement } from "react"
import { Resend } from "resend"

export interface SendEmailOptions {
  to: string | string[]
  subject: string
  react: ReactElement
  replyTo?: string
}

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null

/**
 * Renders a React Email template and sends it with Resend.
 *
 * Without RESEND_API_KEY (the default in development) the email is printed to
 * the console instead — links included — so auth flows work out of the box.
 * Preview and tweak templates live with `pnpm email:dev`.
 */
export async function sendEmail({ to, subject, react, replyTo }: SendEmailOptions) {
  const [html, text] = await Promise.all([
    render(react),
    render(react, { plainText: true }),
  ])

  if (!resend) {
    printEmail(to, subject, text)
    return
  }

  const { error } = await resend.emails.send({
    from: env.EMAIL_FROM,
    to,
    subject,
    html,
    text,
    replyTo,
  })
  if (error) throw new Error(`Couldn't send "${subject}" to ${to}: ${error.message}`)
}

function printEmail(to: string | string[], subject: string, text: string) {
  const line = "─".repeat(64)
  const body = text
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => `│ ${l}`)
  console.info(
    [
      "",
      `┌${line}`,
      `│ 📬  ${subject}  (RESEND_API_KEY not set — printed, not sent)`,
      `│ to: ${Array.isArray(to) ? to.join(", ") : to}`,
      `├${line}`,
      ...body,
      `└${line}`,
      "",
    ].join("\n")
  )
}
