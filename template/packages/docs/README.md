# Klin App docs

Everything you need to work on this codebase. Start at the top.

| Guide | What's inside |
| --- | --- |
| [Getting started](./getting-started.md) | Run it locally in five commands, project tour, everyday scripts |
| [Architecture](./architecture.md) | How the apps and packages fit together, request lifecycle, auth, errors |
| [How the shared validators flow](./validators-flow.md) | One Zod schema → form, request, response, types |
| [Add a feature](./add-a-feature.md) | Walkthrough: from `klin generate resource` to a finished page |
| [Testing](./testing.md) | Vitest unit tests, Playwright end-to-end tests |
| [Deployment](./deployment.md) | Docker, PaaS, VPS, environment checklist, cookies across origins |
| [Upgrading & modules](./upgrading.md) | `klin add` / `remove` / `upgrade`, keeping dependencies fresh |
<!-- klin:if organizations -->
| [Organizations & RBAC](./organizations.md) | Teams, invitations, roles, permission checks |
<!-- klin:endif -->
<!-- klin:if email -->
| [Email](./email.md) | React Email templates, Resend, previewing |
<!-- klin:endif -->
<!-- klin:if uploads -->
| [File uploads](./uploads.md) | Presigned URLs, S3/R2 setup, CORS |
<!-- klin:endif -->
<!-- klin:if queues -->
| [Background jobs](./background-jobs.md) | BullMQ queues, processors, retries |
<!-- klin:endif -->
