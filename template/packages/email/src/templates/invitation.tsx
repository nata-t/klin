// klin:file organizations
import { ActionButton, EmailLayout, FallbackLink, Paragraph } from "./layout"

interface Props {
  url: string
  organization: string
  inviter: string
}

export function InvitationEmail({ url, organization, inviter }: Props) {
  return (
    <EmailLayout
      preview={`${inviter} invited you to ${organization}`}
      heading={`Join ${organization}`}
    >
      <Paragraph>
        {inviter} invited you to collaborate in <strong>{organization}</strong>.
      </Paragraph>
      <ActionButton href={url}>Accept invitation</ActionButton>
      <FallbackLink href={url} />
    </EmailLayout>
  )
}

InvitationEmail.PreviewProps = {
  url: "http://localhost:5173/accept-invitation/preview",
  organization: "Acme Inc.",
  inviter: "Grace",
} satisfies Props

export default InvitationEmail
