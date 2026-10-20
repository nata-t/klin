import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from "@react-email/components"
import type { ReactNode } from "react"

export const APP_NAME = "Klin App"

/**
 * The klin mark (a K drawn as a dependency graph) as pixel art: email
 * clients drop SVG, but every one of them draws table cells.
 */
const MARK = [
  "##...##",
  "##...##",
  "#...#..",
  "#..#...",
  "#.#....",
  "##.....",
  "##.....",
  "#.#....",
  "#..#...",
  "#...#..",
  "##...##",
  "##...##",
]
const PIXEL = 2

function Mark() {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      style={{ borderCollapse: "collapse" }}
    >
      <tbody>
        {MARK.map((row, y) => (
          <tr key={y}>
            {[...row].map((px, x) => (
              <td
                key={x}
                style={{
                  width: `${PIXEL}px`,
                  height: `${PIXEL}px`,
                  padding: 0,
                  fontSize: 0,
                  lineHeight: `${PIXEL}px`,
                  backgroundColor: px === "#" ? "#18181b" : "transparent",
                }}
              />
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const styles = {
  body: {
    backgroundColor: "#f6f6f7",
    fontFamily:
      'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
    padding: "32px 0",
  },
  container: {
    backgroundColor: "#ffffff",
    borderRadius: "12px",
    margin: "0 auto",
    maxWidth: "480px",
    padding: "32px",
  },
  brand: { margin: "0 0 24px" },
  name: { fontSize: "18px", fontWeight: 700, paddingLeft: "10px" },
  heading: { fontSize: "20px", fontWeight: 600, margin: "0 0 12px" },
  text: { color: "#3f3f46", fontSize: "15px", lineHeight: "24px" },
  button: {
    backgroundColor: "#18181b",
    borderRadius: "8px",
    color: "#ffffff",
    display: "inline-block",
    fontSize: "15px",
    fontWeight: 600,
    padding: "12px 20px",
    textDecoration: "none",
  },
  muted: { color: "#71717a", fontSize: "13px", lineHeight: "20px" },
} as const

export function EmailLayout({
  preview,
  heading,
  children,
}: {
  preview: string
  heading: string
  children: ReactNode
}) {
  return (
    <Html>
      <Head />
      <Preview>{preview}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <table role="presentation" cellPadding={0} cellSpacing={0} style={styles.brand}>
            <tbody>
              <tr>
                <td style={{ verticalAlign: "middle" }}>
                  <Mark />
                </td>
                <td style={{ ...styles.name, verticalAlign: "middle" }}>{APP_NAME}</td>
              </tr>
            </tbody>
          </table>
          <Text style={styles.heading}>{heading}</Text>
          {children}
          <Hr style={{ borderColor: "#e4e4e7", margin: "28px 0 16px" }} />
          <Text style={styles.muted}>
            You received this email because of an action on {APP_NAME}. If it
            wasn&apos;t you, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={styles.text}>{children}</Text>
}

export function ActionButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Section style={{ margin: "24px 0" }}>
      <Button href={href} style={styles.button}>
        {children}
      </Button>
    </Section>
  )
}

export function FallbackLink({ href }: { href: string }) {
  return (
    <Text style={styles.muted}>
      Button not working? Paste this link into your browser:
      <br />
      {href}
    </Text>
  )
}
