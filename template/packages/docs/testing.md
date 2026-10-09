# Testing

## Unit tests — Vitest

`pnpm test` runs every package's `test` script through Turborepo (cached).
The example lives in `packages/validators/src/note.test.ts`. Schemas are the
easiest high-value thing to test, since both the API and the forms depend on
them.

```bash
pnpm test                          # everything
pnpm --dir packages/validators exec vitest   # watch mode for one package
```

Add `vitest` and a `"test": "vitest run"` script to any package to include it.

## End-to-end — Playwright

`apps/web/e2e/*.spec.ts` drive a real browser against **production builds**
of the API and the web app (Playwright starts both).

```bash
pnpm build
pnpm --dir apps/web exec playwright install chromium   # first time only
pnpm test:e2e
```

The tests need a database. Locally that's your dev database; in CI, a fresh
one (`pnpm db:push`).
<!-- klin:if ci -->
GitHub Actions runs the whole suite on every pull request
(`.github/workflows/ci.yml`) and uploads the Playwright report when a test
fails.
<!-- klin:endif -->
