// klin:file magic-link
import { ActionButton, EmailLayout, FallbackLink, Paragraph } from "./layout"

interface Props {
  url: string
}

export function MagicLinkEmail({ url }: Props) {
  return (
    <EmailLayout preview="Your sign-in link" heading="Sign in with one click">
      <Paragraph>Here&apos;s your magic link. It works once and expires in five minutes.</Paragraph>
      <ActionButton href={url}>Sign in</ActionButton>
      <FallbackLink href={url} />
    </EmailLayout>
  )
}

MagicLinkEmail.PreviewProps = { url: "http://localhost:5173/api/auth/magic-link/verify?token=preview" } satisfies Props

export default MagicLinkEmail
