# Email

Transactional emails are [React Email](https://react.email) components in
`packages/email/src/templates`, sent with [Resend](https://resend.com).

```bash
pnpm email:dev    # live preview of every template at http://localhost:3030
```

## Sending

```ts
import { sendEmail, WelcomeEmail } from "@repo/email"

await sendEmail({ to: user.email, subject: "Welcome!", react: WelcomeEmail({ name: user.name, url }) })
```

Better Auth's emails (verify, reset password, magic link, invitations) go
through `packages/auth/src/emails.ts`.

## Development vs production

- **No `RESEND_API_KEY`** (the default in development): emails are printed to
  the API console, links included. Sign-up and reset flows work without an
  email provider.
- **Production:** verify your domain in Resend, set `RESEND_API_KEY` and
  `EMAIL_FROM="Your App <hello@yourdomain.com>"`.

Using a different provider? Replace the body of `sendEmail` in
`packages/email/src/send.ts`. Everything else stays the same.
