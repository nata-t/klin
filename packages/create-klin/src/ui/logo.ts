import type { Canvas } from "./canvas";
import { type LogoSize, logoArt } from "./logo-art";
import { colorEnabled, type Style, unicode } from "./theme";

export type { LogoSize } from "./logo-art";
export { logoArt } from "./logo-art";

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

/* ─── The intro sweep ──────────────────────────────────────────────────── */

const INTRO_MS = 900;
let introStart = 0;

/** Starts the one-time sweep of light across the logo (the screen repaints while it runs). */
export function playIntro() {
  if (colorEnabled) introStart = Date.now();
}

export const introRunning = () =>
  introStart > 0 && Date.now() - introStart < INTRO_MS;

/**
 * Where the band of light is (0..1 across the logo), or null once it has
 * passed — the settled logo has no band, so the sweep ends without a jump.
 */
function band(): number | null {
  if (!introRunning()) return null;
  return -0.3 + ((Date.now() - introStart) / INTRO_MS) * 1.6;
}

/* ─── Drawing ──────────────────────────────────────────────────────────── */

const level = (n: number): Style["fg"] => [n, n, n];

/** A wire's gray: quieter than the nodes, so the graph reads as packages joined by lines. */
export const WIRE_SHADE = 0x72;

/**
 * A cell's gray at rest: nodes and letters in a chrome gradient (white at the
 * top, silver at the bottom), wires in a quiet gray.
 */
export function logoShade(
  kind: "node" | "wire" | "word" | "text",
  row: number,
  rows: number,
) {
  if (kind === "wire") return WIRE_SHADE;
  if (kind === "text") return 0xee;
  return Math.round(
    0xfa - (0xfa - 0xa4) * Math.min(1, row / Math.max(1, rows - 1)),
  );
}

/**
 * Draws the logo centered in [x, x + w) from row `y`: the graph mark and the
 * wordmark, with the CLI's band of light sweeping across once on first open.
 */
export function drawLogo(
  canvas: Canvas,
  x: number,
  w: number,
  y: number,
  size: LogoSize,
) {
  const art = logoArt(size);
  const left = x + Math.floor((w - art.width) / 2);
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
