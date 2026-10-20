# klin brand

The mark is **an egg with its first crack, the cap lifted**: something new
hatching, out of a clean shell. Next to it sits a geometric lowercase
**klin**; the mark isn't a letter, so the name is only said once. It's one
colour and always gray: ink on light, white on dark.

Open [`preview.html`](./preview.html) to see every file at real size, on light
and dark, in a browser tab and in the terminal.

## Files

| Path | What it's for |
|---|---|
| `logo/klin-mark-{black,white,mono}.svg` | The mark. `black` for light backgrounds, `white` for dark, `mono` uses `currentColor` (inline it). |
| `logo/klin-lockup-{black,white,mono}.svg` | Mark + wordmark, the same three ways. The `.png`s are for places without SVG (the npm README). |
| `logo/klin-icon.svg` | The app icon: the white mark on the ink tile. |
| `favicon/` | favicon.ico (16, 32, 48), favicon.svg, touch and PWA icons, `site.webmanifest`. |
| `social/og.png` | Link previews (1200×630). The website serves it. |
| `social/github-social.png` | The repo's social preview (1280×640). Upload it by hand: Settings → Social preview. |
| `src/` | The generator: `mark.mjs` (geometry), `build.mjs`, `preview.html` (the sheet's template). |

## Where it's used

- **CLI** — `packages/create-klin/src/ui/logo-art.ts` holds the mark and the
  wordmark as pixel art (two square pixels per character). The full-screen
  header, the banner and `--help` draw the largest size that fits (10, 6 or 3
  rows, or one line). The first time the full screen opens (and in the
  banner), the egg hatches: it wobbles, cracks and the cap pops up.
- **Website** — the hero animates that same pixel art: the egg flies in,
  wobbles, cracks and pops its cap. The nav, footer, docs header and the last
  section use `website/src/components/brand/` (`KlinMark.astro`,
  `KlinLockup.astro`, the cap and the shell as separate paths): the nav's egg
  hatches on hover, the last section's every few seconds. Favicons and
  `og.png` are in `website/public/`.
- **Generated app** — `template/apps/web/public/favicon.svg`, `<Logo>` (the
  mark on the app's brand color, from `components/klin-mark.tsx`), the landing
  page's terminal and the email header (the 12 px pixel mark as table cells,
  since email clients drop SVG).
- **READMEs** — the root README (SVG lockup, light and dark) and the npm
  README (PNG lockup).

## Rules

- **Clear space:** the cap's height on every side.
- **Smallest sizes:** the mark at 16 px tall; under 48 px use the favicon files
  (pixel-aligned cuts). The lockup at 80 px wide on screen, 20 mm in print.
- **Colours:** Ink `#141414`, White `#ffffff`. The terminal draws it in a
  chrome gradient, white at the top to silver at the bottom.
- **Don't** color it, add gradients, shadows or outlines, rotate, mirror or
  stretch it, close the crack (outside the hatching animations), or set the
  name in another typeface beside it.

## Rebuilding

```bash
node brand/src/build.mjs
```

It regenerates everything here and copies it into the app: `website/public/`
(favicons, manifest, `og.png`), `template/apps/web/public/favicon.svg`, the
website's `components/brand/*.astro` and the template's `klin-mark.tsx`. It
needs the website's dependencies installed (for sharp) and Chrome at
`/usr/bin/google-chrome` (for the social cards). The pixel art for the CLI and
the favicons lives in `logo-art.ts`; edit it there.
