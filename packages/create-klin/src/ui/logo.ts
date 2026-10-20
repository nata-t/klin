import type { CellKind } from "./logo-art";

/**
 * The klin mark — the egg — for the CLI: its pixel art lives in ./logo-art.ts
 * (the banner and the screens draw the KLIN wordmark, ./wordmark.ts).
 */

export type { LogoPose, LogoSize } from "./logo-art";
export { LID_CLOSED, logoArt } from "./logo-art";

/**
 * The full-screen header's corner shows the version. A renderer that can
 * draw images there (the website's in-browser wizard, on a canvas) switches
 * `markImage` on and draws MARK_GLYPH as the egg at text height, just before
 * it. Terminals can't show images, and no text glyph makes a good egg that
 * small, so they get the version alone.
 */
export const markImage = { on: false };
export const MARK_GLYPH = "\uE000";

/* ─── Shading ──────────────────────────────────────────────────────────── */

/**
 * A cell's gray at rest: the egg and the letters in a chrome gradient (white
 * at the top, silver at the bottom); plain text a flat bright gray.
 */
export function logoShade(kind: CellKind, row: number, rows: number) {
  if (kind === "text") return 0xee;
  return Math.round(
    0xfa - (0xfa - 0xa4) * Math.min(1, row / Math.max(1, rows - 1)),
  );
}
