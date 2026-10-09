# Upgrading & modules

This project was **scaffolded**, not installed: the code is yours, and there's
no framework package to bump. Here's how it stays current anyway.

## Switch modules on and off

```bash
pnpm klin list                    # what's available, what's on
pnpm klin add organizations email # bolt modules on
pnpm klin remove email            # take one out
```

`klin add`/`remove` render the template twice, with your current options and
with the new ones, and apply the difference to your project like a
`git merge`:

- Files you never edited are updated or removed directly.
- Files you edited get a 3-way merge. Both sides adding lines at the same spot
  (e.g. an import above a `klin-anchor` comment) is merged automatically.
- Real conflicts get `<<<<<<< yours` / `>>>>>>> klin` markers to resolve.
- New `.env` variables are appended to `.env` (with fresh secrets).

Always run it on a clean git tree and review with `git diff`. Afterwards:
`pnpm db:migrate` if the schema changed.

## Template upgrades (experimental)

```bash
pnpm add -D create-klin@latest
pnpm klin upgrade
```

Same mechanism. The *base* is the template from the version recorded in
`klin.json`, the *target* is the new one, and the difference merges into your
code. Commit first, read the diff, run your tests.

## Dependencies
<!-- klin:if ci -->

Renovate (`renovate.json`) opens grouped PRs: NestJS, Prisma, Better Auth,
TanStack and React each move together. It waits 3 days after a release, and
auto-merges minor/patch dev-dependency updates when CI is green. Enable the
[Renovate GitHub app](https://github.com/apps/renovate) on the repo to start.
<!-- klin:else -->

Update dependencies in groups that must move together (all `@nestjs/*`, all
`prisma`/`@prisma/*`, all `better-auth`/`@better-auth/*`, all `@tanstack/*`).
`pnpm outdated -r` lists what's behind. `klin add ci` sets up Renovate to do
this for you.
<!-- klin:endif -->

`pnpm klin doctor` flags dependencies declared with different versions in
different packages, and families (like Prisma) that drifted apart.
