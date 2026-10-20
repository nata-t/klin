# klin website

The landing page and the docs, built with [Astro](https://astro.build) and
[Starlight](https://starlight.astro.build). It's a private workspace package:
the release workflow never builds or publishes it.

```bash
pnpm site:dev      # http://localhost:4321
pnpm site:build    # → website/dist (static), checks every internal link
pnpm site:check    # astro check (types)
```

## Layout

```
website/
  astro.config.mjs        Starlight config, the docs sidebar, grayscale code themes
  cli-bridge.mjs          Vite plugin that runs the CLI's own code in the browser (below)
  public/                 favicon, og.png (the share image)
  src/
    pages/index.astro     the landing page
    pages/llms.txt.ts     /llms.txt: the docs as plain text for AI assistants
    layouts/Landing.astro
    components/landing/   the six landing sections, the nav, the footer
    components/reference/ tables generated from template/klin.template.json
    components/docs/      Starlight overrides (site title) and the changelog
    content/docs/docs/    the docs, served under /docs
    scripts/              landing-page behavior: the intro clock, hero, scroll ruler, motion, demos, grow story
    wizard/               the on-page terminal and the browser stand-ins for the CLI
    styles/               the Tailwind entry points: landing.css and docs.css
    lib/                  data the pages share (manifest, schema demo fields, grow transcripts)
```

## Nothing is copied from the CLI

The site reads the real thing wherever it can, so it can't drift:

- **The wizard** on the landing page is `packages/create-klin/src/commands/wizard.ts`,
  drawing into a `<canvas>`. `cli-bridge.mjs` gives the modules in
  `packages/create-klin/src` browser stand-ins for `node:fs`, `node:path`,
  `process` and the terminal `screen` (see `src/wizard/shims/`). When a visitor
  builds, it hands them the shortest `create klin` command for their picks.
- **The hero logo** hatches KLIN out of the egg, on one grid of square
  pixels (`src/lib/hero-logo.ts`): the vector egg from `brand/`, rasterized,
  and the CLI's own KLIN wordmark (`drawWordmark()`), its letters split into
  pixels, its box-drawing shadow and sparkles kept whole. The egg drops in,
  wobbles, cracks and pops its cap; its pixels fly out as K, L, I and N,
  then the shadow extrudes, the chrome pours in and the sparkles pop
  (`src/scripts/hero-field.ts`, timed by `src/scripts/intro.ts`). A click
  folds KLIN back into the egg and hatches it again.
- **The "only what you picked" demo** runs the template's real
  `packages/auth/src/auth.ts` through the CLI's marker engine.
- **Options, presets, flags and the kit grid** are generated from
  `template/klin.template.json`.
- **The version** shown everywhere is `packages/create-klin/package.json`'s.
- **The changelog** page renders `packages/create-klin/CHANGELOG.md`.

The `generate` / `add` / `doctor` transcripts in `src/lib/grow-acts.ts` are
copied from real runs; refresh them if the CLI's output changes.

If you change the wizard's imports and the site build breaks, the fix usually
belongs in `cli-bridge.mjs` or `src/wizard/shims/`.

## Design

Same rules as the CLI (`packages/create-klin/src/ui/theme.ts`): grayscale,
hierarchy through brightness, weight and glyphs. The only hues are the status
pair (red errors, amber warnings) and theme swatches. Geist Mono for structure
and headings, Geist for reading. Motion (Lenis smooth scroll, GSAP reveals,
the opening, the pinned story) switches off for visitors who prefer reduced
motion, and the page reads complete without JavaScript.

The opening runs on one clock (`src/scripts/intro.ts`): the create command is
typed, K, L, I and N fly in and snap together, then the nav, the scroll ruler
and the copy arrive on its beats. Any input fast-forwards it, and repeat
visitors get it compressed. The scroll ruler (`src/scripts/ruler.ts`) replaces
the scrollbar on desktop pointers: a tick track 1:1 with the page, a needle
that points at its own percentage, the sections on the spine, and a page map
on hover. Phones and tablets keep their native scrollbar.

## Styling

Everything is styled with [Tailwind CSS](https://tailwindcss.com) v4
(`@tailwindcss/vite`), utilities in the markup. Two entry points:

- `src/styles/landing.css` — the landing page. Its theme is the CLI's grays
  and nothing else (`text-muted`, `bg-bar`, `border-line` …), the two fonts,
  and pixel spacing (`--spacing: 1px`, so `p-14` is 14px). The breakpoints
  are desktop-first variants, `max-720:` meaning `(max-width: 720px)`.
  `hud` (the mono micro-label) and `assemble` (the opening's transition) are
  its two custom utilities; animations are theme tokens (`animate-sheen` …).
- `src/styles/docs.css` — Starlight's custom CSS: Tailwind's utilities layered
  after Starlight's own, with a theme that points at Starlight's variables
  (`text-gray-3` follows light and dark). Its plain CSS restyles Starlight's
  markup, which takes no classes of ours.

Neither loads Tailwind's Preflight: the landing page keeps a small base layer
of its own, and Starlight has its reset. Repeated pieces are components
(`Button`, `Chip`, `Command`, `FileHeader`, `SectionHead` …), not classes.
HTML the scripts generate either carries utilities itself (the schema form,
the ruler) or marks tokens (`.k`, `.line`, `.drop` …) that its container
styles with arbitrary variants (`[&_.k]:text-bright`), so the highlighter's
output can look different in different panes.

## Before launch

- Set `site` in `astro.config.mjs` to the real domain (canonical URLs, sitemap,
  absolute share-image URLs).
- Point `homepage` in `packages/create-klin/package.json`, the root README and
  the `Docs:` line in `klin --help` at the site.
- Hosting: it's a static build (`website/dist`), so any static host works.
