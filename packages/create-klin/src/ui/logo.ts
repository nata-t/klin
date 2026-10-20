import {
  type CellKind,
  LID_CLOSED,
  type LogoPose,
  type LogoSize,
  logoArt,
} from "./logo-art";

export type { LogoPose, LogoSize } from "./logo-art";
export { LID_CLOSED, logoArt } from "./logo-art";

/** The regular lockup as text — the generated app's landing terminal copies it. */
export const LOGO = logoArt(6).lines;

/** The small egg the banner and `--help` draw: 5 columns, 3 rows. */
export const MARK_WIDTH = 5;

/**
 * The full-screen header's corner shows the version. A renderer that can
 * draw images there (the website's in-browser wizard, on a canvas) switches
 * `markImage` on and draws MARK_GLYPH as the egg at text height, just before
 * it. Terminals can't show images, and no text glyph makes a good egg that
 * small, so they get the version alone.
 */
export const markImage = { on: false };
export const MARK_GLYPH = "\uE000";

/* ─── The hatch (the banner plays it) ──────────────────────────────────── */

/**
 * The hatch, as keyframes: from `ms`, the cap sits `lid` of the way to
 * closed (1 closed, ½ cracked, 0 open) and the egg is nudged `nudge` pixels
 * right. A closed egg wobbles, cracks, wobbles once more, and the cap pops.
 */
export const HATCH: ReadonlyArray<{ ms: number; lid: number; nudge: number }> =
  [
    { ms: 0, lid: 1, nudge: 0 },
    { ms: 140, lid: 1, nudge: 1 },
    { ms: 220, lid: 1, nudge: 0 },
    { ms: 300, lid: 1, nudge: 1 },
    { ms: 380, lid: 1, nudge: 0 },
    { ms: 540, lid: 0.5, nudge: 0 },
    { ms: 640, lid: 0.5, nudge: 1 },
    { ms: 700, lid: 0.5, nudge: 0 },
    { ms: 780, lid: 0, nudge: 0 },
  ];

/** The egg's pose `ms` into the hatch, in pixels for a mark of `size`. */
export function hatchPose(size: LogoSize, ms: number): LogoPose {
  let frame = HATCH[0]!;
  for (const k of HATCH) if (ms >= k.ms) frame = k;
  const closed = size === 10 ? LID_CLOSED[20] : size === 6 ? LID_CLOSED[12] : LID_CLOSED[6];
  return { lid: Math.round(frame.lid * closed), nudge: frame.nudge };
}

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
