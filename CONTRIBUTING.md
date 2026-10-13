# Contributing to klin

## Layout

```
packages/create-klin/   the CLI (published as `create-klin`, bins: create-klin + klin)
  src/engine/           markers, expressions, manifest, render
  src/commands/         create · add/remove/upgrade (transition) · generate · doctor · list
  src/generators/       `klin generate resource` templates
  src/ui/               the grayscale UI kit: canvas, full-screen form, prompts, logs, logo, theme
  test/                 unit tests + the rendering matrix
template/               the kit: a full monorepo with every module on
  klin.template.json    questions, options, steps, strip/move rules, presets
  apps/api/src/         the NestJS API (the default backend)
  apps/api/plain*/      the plain Express / Fastify APIs, merged into src/ when picked
  variants/             files that only exist for some answers (e.g. packages/ui)
scripts/                maintenance (dependency ages, playground)
demo/                   VHS tape for the README GIF
```

## Develop

```bash
pnpm install
pnpm --filter create-klin dev        # tsup --watch
pnpm test
pnpm playground everything pnpm      # renders + installs into .playground/
FORCE_COLOR=3 pnpm --filter create-klin exec tsx scripts/preview-ui.ts /tmp/ui 130 42
                                     # wizard frames as HTML screenshots, no TTY needed
```

The CLI finds the template at `../../template` when it runs from a checkout,
and adds itself to generated projects as `file:<path>`, so `pnpm klin …` inside
a playground uses your local build.

Before opening a PR, render the presets you touched and run
`pnpm turbo run typecheck lint test build` inside them. CI does this for a
matrix of presets × package managers × databases.

## Template authoring

### Markers

Put directives in a comment on their own line, using the file's own comment
syntax (`//`, `#`, `/* */`, `{/* */}`, `<!-- -->`, `--`):

| Directive | Meaning |
| --- | --- |
| `klin:if <expr>` · `klin:elif <expr>` · `klin:else` · `klin:endif` | conditional block (nestable) |
| `klin:file <expr>` | keep the whole file only if true |
| `<code>` + trailing `klin:only <expr>` | keep this one line only if true |
| `//? code`, `#? code`, `/*? code */`, `{/*? code */}` | *dormant* line: commented out in the template, uncommented when its branch is kept |

Expressions: flag names joined with `!`, `&&`, `||` and parentheses. Flags are
option ids (`google`, `organizations`, `sqlite`, …), select options with their
`flagPrefix` (`accent-violet`), the package manager (`pnpm` / `bun` / `npm`) and
derived flags from the manifest (`oauth`, `compose`, …). An unknown flag fails
the render with a file:line error, so typos can't silently strip code.

Use dormant lines for mutually exclusive variants (databases, package
managers), so the template stays valid with the default variant active.

When a variant is a different *set of files* rather than a few lines, keep it
in its own folder and `move` it into place with a rule. The plain backends work
this way: `apps/api/plain/` (shared: services, errors, logger) plus
`apps/api/plain-express/` or `apps/api/plain-fastify/` are merged into
`apps/api/src/`, and they import each other by their final paths
(`../services/notes`). Check them in a rendered project — the playground or the
render-matrix tests — rather than in place.

### The manifest (`klin.template.json`)

- `questions`: the prompts, in order. `select` or `multiselect`, with the CLI
  `flag` name and defaults.
- `options`: every option's `label`/`hint`, `requires` (auto-enabled
  dependencies), `remove` (globs deleted when the option is **off**) and `json`
  (package.json keys deleted when it's off).
- `flags`: derived flags as expressions. `scaffolded` is always on when
  rendering, so `klin:if !scaffolded` marks lines that only exist in the
  template itself.
- `rules`: `{ when, remove?, json?, merge?, move?, replace? }` applied when
  `when` is true:
  - `move` remaps output paths after `remove` (`"apps/api/plain/": "apps/api/src/"`
    moves a folder, a key without a trailing slash moves one file). Two files
    landing on the same path fail the render.
  - `replace` rewrites literal text in rendered files matched by output path
    (how `packages-ui` turns `@/components/ui/x` into `@repo/ui/components/x`).
  - `merge` deep-merges keys into JSON files (`json` only removes).
- `steps`: how the interactive CLI pages the questions (`title`, `heading`,
  `subtitle`, `questions`). The CLI adds its own first (name, package manager,
  preset) and last (review & build) steps; keep the total at six or fewer.
- Each question can have a `title` (its chip-group label) and `groups` to split
  a long option list visually. Each option and preset can have `about` — two or
  three sentences shown while it's highlighted (say what it is and how it gets
  set up) — and options a `swatch` color.
- `presets`: named answer sets.
- `tokens`: strings replaced with the project name (`klin-app`, `klin_app`, `Klin App`).
- `env.generate`: `.env` keys that get random values (other occurrences of the
  example value, e.g. inside `DATABASE_URL`, are updated to match).

### Package-manager neutrality

Write commands with **pnpm** in the template. Scripts in `package.json`,
husky hooks and code blocks in Markdown are rewritten for bun/npm
(`pnpm dev` → `npm run dev`, `pnpm exec x` → `bunx x`,
`pnpm --dir packages/db run db:migrate` → `npm --prefix packages/db run db:migrate`).
Workspace ranges become `*` for npm. For YAML/Dockerfiles, use markers with
`pnpm`/`bun`/`npm` branches.

### Anchors

`// klin-anchor:*` comments mark insertion points for `klin generate`
(`exports`, `module-imports`, `modules`, `nav`, `nav-icons`,
`user-relations`, `organization-relations`). Keep them when editing those files.

### Dependency floors

pnpm 11 refuses packages younger than a day by default. Keep every `^x.y.z`
floor at least a few days old:

```bash
node scripts/check-dep-ages.mjs --fix
```

## Releases

Versioning uses [Changesets](https://github.com/changesets/changesets):

```bash
pnpm changeset          # describe your change (patch/minor/major)
```

On `main`, the release workflow opens a "Version packages" PR that bumps the
version and updates `CHANGELOG.md`. Merging it publishes `create-klin` to npm
with provenance.

`klin upgrade` diffs templates between published versions, so treat template
changes as user-facing and describe them in the changeset.
