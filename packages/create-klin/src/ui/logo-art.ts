/**
 * The klin mark — an egg with its first crack, the cap lifted: something new
 * hatching — and the "klin" wordmark, as terminal pixel art.
 *
 * Each character cell holds two square pixels stacked (▀ ▄ █). In the
 * bitmaps `o` is the cap, `#` the shell or a letter and `.` empty. The cap
 * and the shell are drawn separately so they can move: the CLI's screen
 * opens with the egg hatching (a closed egg wobbles, cracks, and the cap
 * pops up), and the website's hero does the same. The vector original is in
 * brand/ (brand/README.md).
 *
 * No imports: the CLI, the website (through the CLI bridge) and the brand
 * build all read this file.
 */

/** How many rows the logo takes: the big lockup, the regular one, the compact one, or one line. */
export type LogoSize = 10 | 6 | 3 | 1;

/** The egg's cap or its shell, a pixel letter of the wordmark, or a plain text character. */
export type CellKind = "cap" | "shell" | "word" | "text";

export interface LogoCell {
  col: number;
  row: number;
  ch: string;
  kind: CellKind;
  /** Which part it belongs to: 0 for the egg (cap and shell move as one), then one per letter. */
  part: number;
}

export interface LogoArt {
  width: number;
  height: number;
  cells: LogoCell[];
  /** How many parts (the egg, then the letters) the art has. */
  parts: number;
  /** The art as plain text, one string per row. */
  lines: string[];
}

/**
 * Where the egg is mid-hatch: `lid` is how many pixels lower the cap sits
 * than at rest (LID_CLOSED closes the crack), `nudge` how far right the whole
 * egg is pushed (a wobble). The resting logo is { lid: 0, nudge: 0 }.
 */
export interface LogoPose {
  lid: number;
  nudge: number;
}

/** 20 px: 16 wide, the crack's teeth at 45°, the cap lifted one pixel. */
const MARK_20 = [
  "......oooo......",
  "....oooooooo....",
  "...oooooooooo...",
  "..oooooooooooo..",
  ".oooooooooooooo.",
  "..ooooo..ooooo..",
  "...ooo....ooo...",
  ".#..o..##..o..#.",
  "###...####...###",
  "####.######.####",
  "################",
  "################",
  "################",
  "################",
  "################",
  ".##############.",
  ".##############.",
  "..############..",
  "...##########...",
  ".....######.....",
];

/** 12 px: the same egg, 10 wide. */
const MARK_12 = [
  "...oooo...",
  "..oooooo..",
  ".ooo..ooo.",
  "..o....o..",
  "....##....",
  ".#.####.#.",
  "##########",
  "##########",
  "##########",
  ".########.",
  "..######..",
  "...####...",
];

/** 6 px: one tooth — the cap's notch above the shell's point, a pixel apart. */
const MARK_6 = [".ooo.", "oo.oo", "..#..", "#####", "#####", ".###."];

/** How far the cap drops to close the crack, by pixel height. */
export const LID_CLOSED: Record<20 | 12 | 6, number> = { 20: 2, 12: 2, 6: 1 };

/** The "klin" letters: 16 px (2 px stems, x-height 11) and 10 px (x-height 7). */
const WORD_16: Record<string, string[]> = {
  k: [
    "##.......",
    "##.......",
    "##.......",
    "##.......",
    "##.......",
    "##.....##",
    "##....##.",
    "##...##..",
    "##..##...",
    "##.##....",
    "####.....",
    "##.##....",
    "##..##...",
    "##...##..",
    "##....##.",
    "##.....##",
  ],
  l: Array<string>(16).fill("##"),
  i: [
    "##",
    "##",
    "..",
    "..",
    "..",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
    "##",
  ],
  n: [
    "........",
    "........",
    "........",
    "........",
    "........",
    "#######.",
    "########",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
    "##....##",
  ],
};
const WORD_10: Record<string, string[]> = {
  k: [
    "##....",
    "##....",
    "##....",
    "##..##",
    "##.##.",
    "####..",
    "###...",
    "####..",
    "##.##.",
    "##..##",
  ],
  l: Array<string>(10).fill("##"),
  i: ["##", "##", "..", "##", "##", "##", "##", "##", "##", "##"],
  n: [
    "......",
    "......",
    "......",
    "#####.",
    "######",
    "##..##",
    "##..##",
    "##..##",
    "##..##",
    "##..##",
  ],
};
const LETTERS = ["k", "l", "i", "n"] as const;

/** The mark's bitmaps by pixel height (`o` cap, `#` shell) — brand/ draws the pixel-perfect favicons from them. */
export const PIXEL_MARKS: Record<20 | 12 | 6, string[]> = {
  20: MARK_20,
  12: MARK_12,
  6: MARK_6,
};

const REST: LogoPose = { lid: 0, nudge: 0 };

/**
 * Lays the mark (posed) and the word side by side, word baseline on the
 * mark's bottom, as one bitmap of `o` (cap), `s` (shell), `w` (letter) and `.`.
 */
function bitmap(
  mark: string[],
  word: Record<string, string[]> | null,
  gap: number,
  pose: LogoPose,
) {
  const markW = mark[0]!.length;
  const pixels: string[][] = mark.map(() => []);
  mark.forEach((line, y) =>
    [...line].forEach((px, x) => {
      if (px === ".") return;
      const ny = y + (px === "o" ? pose.lid : 0);
      const nx = x + pose.nudge;
      if (ny < 0 || ny >= mark.length || nx < 0) return;
      pixels[ny]![nx] = px === "o" ? "o" : "s";
    }),
  );
  /** Where each letter starts, in pixel columns. */
  const letterAt: number[] = [];
  if (word) {
    const off = mark.length - word.k!.length;
    let x = markW + gap;
    for (const letter of LETTERS) {
      letterAt.push(x);
      const rows = word[letter]!;
      rows.forEach((line, y) =>
        [...line].forEach((px, dx) => px === "#" && (pixels[off + y]![x + dx] = "w")),
      );
      x += rows[0]!.length + 2;
    }
  }
  const width = Math.max(markW, ...pixels.map((row) => row.length));
  for (const row of pixels) for (let x = 0; x < width; x++) row[x] ??= ".";
  return { pixels, letterAt, width };
}

/** Folds every two pixel rows into one row of ▀ ▄ █ cells. */
function cellsOf(
  mark: string[],
  word: Record<string, string[]> | null,
  gap: number,
  pose: LogoPose,
): LogoArt {
  const { pixels, letterAt, width } = bitmap(mark, word, gap, pose);
  if (pixels.length % 2) pixels.push(Array<string>(width).fill("."));
  const cells: LogoCell[] = [];
  const lines: string[] = [];
  for (let y = 0; y < pixels.length; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const pair = pixels[y]![x]! + pixels[y + 1]![x]!;
      const on = (px: string) => px !== ".";
      const ch =
        on(pair[0]!) && on(pair[1]!)
          ? "█"
          : on(pair[0]!)
            ? "▀"
            : on(pair[1]!)
              ? "▄"
              : " ";
      line += ch;
      if (ch === " ") continue;
      if (pair.includes("w"))
        cells.push({
          col: x,
          row: y / 2,
          ch,
          kind: "word",
          part: letterAt.filter((start) => x >= start).length,
        });
      else
        cells.push({
          col: x,
          row: y / 2,
          ch,
          kind: pair.includes("s") ? "shell" : "cap",
          part: 0,
        });
    }
    lines.push(line.trimEnd());
  }
  return {
    width,
    height: pixels.length / 2,
    cells,
    parts: 1 + (word ? LETTERS.length : 0),
    lines,
  };
}

/** A row of plain text cells (for the compact and one-line logos). */
function textCells(
  text: string,
  col: number,
  row: number,
  firstPart: number,
): LogoCell[] {
  return [...text].map((ch, i) => ({
    col: col + i,
    row,
    ch,
    kind: "text" as const,
    part: firstPart + i,
  }));
}

const cache = new Map<string, LogoArt>();

/**
 * The logo at a size, resting or mid-hatch: the big and regular lockups are
 * pixel art; the compact one sets "klin" beside a small egg.
 */
export function logoArt(size: LogoSize, pose: LogoPose = REST): LogoArt {
  const key = `${size}:${pose.lid}:${pose.nudge}`;
  const hit = cache.get(key);
  if (hit) return hit;
  let art: LogoArt;
  if (size === 10) art = cellsOf(MARK_20, WORD_16, 5, pose);
  else if (size === 6) art = cellsOf(MARK_12, WORD_10, 4, pose);
  else if (size === 3) {
    const mark = cellsOf(MARK_6, null, 0, pose);
    // From the resting width, so a wobble doesn't move the name.
    const col = MARK_6[0]!.length + 3;
    art = {
      ...mark,
      width: col + 4,
      cells: [...mark.cells, ...textCells("klin", col, 1, 1)],
      parts: 5,
      lines: mark.lines.map((line, row) =>
        row === 1 ? line.padEnd(col) + "klin" : line,
      ),
    };
  } else
    art = {
      width: 4,
      height: 1,
      cells: textCells("klin", 0, 0, 0),
      parts: 4,
      lines: ["klin"],
    };
  cache.set(key, art);
  return art;
}
