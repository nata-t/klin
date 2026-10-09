// klin:if email
import {
  InvitationEmail, // klin:only organizations
  MagicLinkEmail, // klin:only magic-link
  ResetPasswordEmail,
  sendEmail,
  VerifyEmail,
} from "@repo/email"
// klin:endif

export type AuthEmail =
  | { type: "verify-email"; to: string; name: string; url: string }
  | { type: "reset-password"; to: string; name: string; url: string }
  | { type: "magic-link"; to: string; url: string } // klin:only magic-link
  | { type: "invitation"; to: string; url: string; organization: string; inviter: string } // klin:only organizations

const SUBJECTS: Record<AuthEmail["type"], string> = {
  "verify-email": "Verify your email address",
  "reset-password": "Reset your password",
  "magic-link": "Your sign-in link", // klin:only magic-link
  invitation: "You've been invited to join a team", // klin:only organizations
}

/** Every email Better Auth sends goes through here. */
export async function sendAuthEmail(email: AuthEmail): Promise<void> {
  const subject = SUBJECTS[email.type]
  // klin:if email
  switch (email.type) {
    case "verify-email":
      return sendEmail({ to: email.to, subject, react: VerifyEmail({ name: email.name, url: email.url }) })
    case "reset-password":
      return sendEmail({ to: email.to, subject, react: ResetPasswordEmail({ name: email.name, url: email.url }) })
    // klin:if magic-link
    case "magic-link":
      return sendEmail({ to: email.to, subject, react: MagicLinkEmail({ url: email.url }) })
    // klin:endif
    // klin:if organizations
    case "invitation":
      return sendEmail({
        to: email.to,
        subject,
        react: InvitationEmail({ url: email.url, organization: email.organization, inviter: email.inviter }),
      })
    // klin:endif
  }
  // klin:else
  // No email provider yet: print the email so you can click the link in dev.
  // `klin add email` wires up Resend + React Email templates.
  printEmail(email.to, subject, email.url)
  // klin:endif
}
// klin:if !email

function printEmail(to: string, subject: string, url: string) {
  const line = "─".repeat(64)
  console.info(
    [
      "",
      `┌${line}`,
      `│ 📬  ${subject}`,
      `│ to:   ${to}`,
      `│ link: ${url}`,
      `└${line}`,
      "",
    ].join("\n")
  )
}
// klin:endif
