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
    styles/               landing.css and docs.css
    lib/                  data the pages share (manifest, schema demo fields, grow transcripts)
```

## Nothing is copied from the CLI

The site reads the real thing wherever it can, so it can't drift:

- **The wizard** on the landing page is `packages/create-klin/src/commands/wizard.ts`,
  drawing into a `<canvas>`. `cli-bridge.mjs` gives the modules in
  `packages/create-klin/src` browser stand-ins for `node:fs`, `node:path`,
  `process` and the terminal `screen` (see `src/wizard/shims/`). When a visitor
  builds, it hands them the shortest `create klin` command for their picks.
- **The hero logo** is the CLI's own pixel art (`logoArt()`, taken apart by
  `src/lib/hero-logo.ts`), in the same chrome gradient. The egg drops in,
  wobbles, cracks and pops its cap; then its pixels fly out as the word, and
  only "klin" is left (`src/scripts/hero-field.ts`, timed by
  `src/scripts/intro.ts`). A click folds the word back into the egg.
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

## Before launch

- Set `site` in `astro.config.mjs` to the real domain (canonical URLs, sitemap,
  absolute share-image URLs).
- Point `homepage` in `packages/create-klin/package.json`, the root README and
  the `Docs:` line in `klin --help` at the site.
- Hosting: it's a static build (`website/dist`), so any static host works.
