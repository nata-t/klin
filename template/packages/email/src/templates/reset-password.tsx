import { ActionButton, EmailLayout, FallbackLink, Paragraph } from "./layout"

interface Props {
  name: string
  url: string
}

export function ResetPasswordEmail({ name, url }: Props) {
  return (
    <EmailLayout preview="Reset your password" heading="Reset your password">
      <Paragraph>
        Hi {name}, someone (hopefully you) asked to reset your password. This link
        expires in one hour.
      </Paragraph>
      <ActionButton href={url}>Choose a new password</ActionButton>
      <FallbackLink href={url} />
    </EmailLayout>
  )
}

ResetPasswordEmail.PreviewProps = { name: "Ada", url: "http://localhost:5173/api/auth/reset-password/preview" } satisfies Props

export default ResetPasswordEmail
