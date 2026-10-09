import { ActionButton, APP_NAME, EmailLayout, Paragraph } from "./layout"

interface Props {
  name: string
  url: string
}

/** Sent by the background job queue after sign-up (when queues are enabled). */
export function WelcomeEmail({ name, url }: Props) {
  return (
    <EmailLayout preview={`Welcome to ${APP_NAME}`} heading={`Welcome, ${name} 👋`}>
      <Paragraph>
        Your account is ready. Jump into your dashboard to create your first note.
      </Paragraph>
      <ActionButton href={url}>Open dashboard</ActionButton>
    </EmailLayout>
  )
}

WelcomeEmail.PreviewProps = { name: "Ada", url: "http://localhost:5173/dashboard" } satisfies Props

export default WelcomeEmail
