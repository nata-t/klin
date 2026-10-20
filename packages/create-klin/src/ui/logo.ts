import type { Canvas } from "./canvas";
import {
  type CellKind,
  LID_CLOSED,
  type LogoPose,
  type LogoSize,
  logoArt,
} from "./logo-art";
import { colorEnabled, type Style, unicode } from "./theme";

export type { LogoPose, LogoSize } from "./logo-art";
export { LID_CLOSED, logoArt } from "./logo-art";

/** The regular lockup as text — the banner and the generated app's hero use it. */
export const LOGO = logoArt(6).lines;

/** Columns the logo needs. */
export function logoWidth(size: LogoSize) {
  return logoArt(size).width;
}

/** The largest logo that fits in `rows` × `columns` (the one-liner always "fits"). */
export function logoSizeFor(rows: number, columns: number): LogoSize {
  if (unicode && rows >= 10 && columns >= logoWidth(10) + 4) return 10;
  if (unicode && rows >= 6 && columns >= logoWidth(6) + 4) return 6;
  if (unicode && rows >= 3 && columns >= logoWidth(3) + 4) return 3;
  return 1;
}

/* ─── The intro: the egg hatches, then a band of light sweeps across ───── */

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
/** When the band of light starts, and how long it takes to cross. */
const SWEEP_AT = 820;
const SWEEP_MS = 900;
const INTRO_MS = SWEEP_AT + SWEEP_MS;
let introStart = 0;

/** Starts the one-time intro (the screen repaints while it runs). */
export function playIntro() {
  if (colorEnabled) introStart = Date.now();
}

export const introRunning = () =>
  introStart > 0 && Date.now() - introStart < INTRO_MS;

/** The egg's pose `ms` into the hatch, in pixels for a mark of `size`. */
export function hatchPose(size: LogoSize, ms: number): LogoPose {
  let frame = HATCH[0]!;
  for (const k of HATCH) if (ms >= k.ms) frame = k;
  const closed = size === 10 ? LID_CLOSED[20] : size === 6 ? LID_CLOSED[12] : LID_CLOSED[6];
  return { lid: Math.round(frame.lid * closed), nudge: frame.nudge };
}

/** The egg right now: mid-hatch while the intro runs, otherwise at rest. */
function pose(size: LogoSize): LogoPose | undefined {
  if (!introRunning()) return undefined;
  return hatchPose(size, Date.now() - introStart);
}

/**
 * Where the band of light is (0..1 across the logo), or null outside the
 * sweep — the settled logo has no band, so the sweep ends without a jump.
 */
function band(): number | null {
  if (!introRunning()) return null;
  const t = (Date.now() - introStart - SWEEP_AT) / SWEEP_MS;
  if (t < 0) return null;
  return -0.3 + t * 1.6;
}

/* ─── Drawing ──────────────────────────────────────────────────────────── */

const level = (n: number): Style["fg"] => [n, n, n];

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

/**
 * Draws the logo centered in [x, x + w) from row `y`: the egg and the
 * wordmark — and, the first time the screen opens, the egg hatching and the
 * CLI's band of light sweeping across.
 */
export function drawLogo(
  canvas: Canvas,
  x: number,
  w: number,
  y: number,
  size: LogoSize,
) {
  // Centered on the resting art, so the wobble moves the egg and not the logo.
  const left = x + Math.floor((w - logoArt(size).width) / 2);
  const art = logoArt(size, pose(size));
  const light = band();
  for (const cell of art.cells) {
    let shade = logoShade(cell.kind, cell.row, art.height);
    if (light !== null) {
      const position = (cell.col + cell.row * 2) / (art.width + art.height * 2);
      const glow = Math.max(0, 1 - Math.abs(position - light) * 6);
      shade = Math.round(shade + (0xff - shade) * glow);
    }
    canvas.text(left + cell.col, y + cell.row, cell.ch, {
      fg: level(shade),
      bold: cell.kind === "text",
    });
  }
}
