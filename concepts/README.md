# klin mark concepts

**Picked: 08 · Hatch.** It's now the klin logo: the vector lives in
[`brand/`](../brand/) and the pixel art in
`packages/create-klin/src/ui/logo-art.ts`. This folder is the record of the
round that chose it.

Fifteen candidates for a new mark. The one they replaced was a K, and next to
the word "klin" the logo read "K klin". None of these is a letter, so the name
is only said once. The wordmark stayed as it was.

Open [`preview.html`](./preview.html) in a browser. **All 15** shows every mark
on ink and on paper, as a favicon, an app icon and terminal pixels; click one
to see it in a browser tab, the CLI header and the README. Star the ones you
like. **Pick one of two** runs a knockout (14 picks for all 15, or just your
starred ones) until one is left. [`overview.png`](./overview.png) is the
same set on one sheet.

| # | Concept | The idea |
|---|---|---|
| 01 | Glint | Four parts of a kit, fitted so the clean space between them shines. |
| 02 | Dovetail | Front end on top, back end below, locked by dovetails: the shared schema is the joint. |
| 03 | Swept | A grid of spots with one clean pass wiped through it: spot-less. |
| 04 | Cairn | Three stones balanced, database, API, web: a stack at rest and a marker for where to start. |
| 05 | Bubbles | Soap bubbles, one with a shine. |
| 06 | Cursor | The block cursor follows the name (klin▌); the icon is an empty screen, cursor waiting. |
| 07 | Peel | The film peeling off a brand-new screen. |
| 08 | Hatch | A smooth egg with its first crack. |
| 09 | Bento | A place for everything, and one dashed slot for what `klin generate` adds next. |
| 10 | Bowtie | Dressed up and ready to ship; also ⋈, the join between front and back. |
| 11 | Spin | A washing machine on a clean cycle. |
| 12 | Sprue | A model-kit frame: every part attached, ready to snap out. |
| 13 | Tangram | Seven pieces make one square; the last one is sliding home. |
| 14 | Droplet | The i is dotted with a drop; on its own the drop is the icon. |
| 15 | Weave | Threads woven through web, API and database: one schema holds the stack together. |

## Files

- `logos/<nn>-<name>-mark.svg`: the mark on a 256 × 256 canvas, one path, ink `#141414`.
- `logos/<nn>-<name>-lockup.svg`: the mark beside the current wordmark.
- `src/marks.mjs`: the geometry. `src/build.mjs` writes `logos/` and `preview.html`
  from `src/preview.html`:

  ```bash
  node concepts/src/build.mjs
  ```

The terminal previews are pixelated automatically. Once a mark is picked, it
gets hand-drawn pixel art in `packages/create-klin/src/ui/logo-art.ts`, and
`brand/` gets rebuilt around it.
