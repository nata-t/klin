import { ActionButton, EmailLayout, FallbackLink, Paragraph } from "./layout"

interface Props {
  name: string
  url: string
}

export function VerifyEmail({ name, url }: Props) {
  return (
    <EmailLayout preview="Confirm your email address" heading="Confirm your email">
      <Paragraph>Hi {name}, welcome aboard! Confirm your email so we know it&apos;s really you.</Paragraph>
      <ActionButton href={url}>Verify email</ActionButton>
      <FallbackLink href={url} />
    </EmailLayout>
  )
}

VerifyEmail.PreviewProps = { name: "Ada", url: "http://localhost:5173/api/auth/verify-email?token=preview" } satisfies Props

export default VerifyEmail
