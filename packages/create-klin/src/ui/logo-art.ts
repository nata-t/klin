/**
 * The klin mark — a K drawn as a dependency graph: five package nodes joined
 * by wires at 0° and 45° — and the "klin" wordmark, as terminal pixel art.
 *
 * Each character cell holds two square pixels stacked (▀ ▄ █), so a node of
 * 2×2 pixels is "██" on one row. In the bitmaps `#` is a node or a letter,
 * `+` a wire and `.` empty. Nodes sit on even pixel rows so they never split
 * across cells. The vector originals are in brand/ (brand/README.md).
 *
 * No imports: the CLI, the website (through the CLI bridge) and the brand
 * build all read this file.
 */

/** How many rows the logo takes: the big lockup, the regular one, the compact one, or one line. */
export type LogoSize = 10 | 6 | 3 | 1;

/** A node or a wire of the mark, a pixel letter of the wordmark, or a plain text character. */
export type CellKind = "node" | "wire" | "word" | "text";

export interface LogoCell {
  col: number;
  row: number;
  ch: string;
  kind: CellKind;
  /** Which part it belongs to: a node (in reading order) or a letter after them; -1 for wires. */
  part: number;
}

export interface LogoArt {
  width: number;
  height: number;
  cells: LogoCell[];
  /** How many parts (nodes and letters) the art has. */
  parts: number;
  /** The art as plain text, one string per row. */
  lines: string[];
}

/** 20 px: 4 px nodes on a 4 px grid, 2 px wires. */
const MARK_20 = [
  "####....####",
  "####....####",
  "####....####",
  "####...+####",
  ".++...++....",
  ".++..++.....",
  ".++.++......",
  ".++++.......",
  "####........",
  "####........",
  "####........",
  "####........",
  ".++++.......",
  ".++.++......",
  ".++..++.....",
  ".++...++....",
  "####...+####",
  "####....####",
  "####....####",
  "####....####",
];

/** 12 px: 2 px nodes, 1 px wires. */
const MARK_12 = [
  "##...##",
  "##...##",
  "+...+..",
  "+..+...",
  "+.+....",
  "##.....",
  "##.....",
  "+.+....",
  "+..+...",
  "+...+..",
  "##...##",
  "##...##",
];

/** 6 px: too small for wires, so a plain K with a heavier joint. */
const MARK_6 = ["#...#", "#..#.", "###..", "###..", "#..#.", "#...#"];

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

/** The mark's bitmaps by pixel height — brand/ draws the pixel-perfect favicons from them. */
export const PIXEL_MARKS: Record<20 | 12 | 6, string[]> = {
  20: MARK_20,
  12: MARK_12,
  6: MARK_6,
};

/** Lays the mark and the word side by side (word baseline on the mark's bottom) as one pixel bitmap. */
function bitmap(
  mark: string[],
  word: Record<string, string[]> | null,
  gap: number,
) {
  const markW = mark[0]!.length;
  const pixels: string[][] = mark.map((line) => [...line]);
  /** Where each letter starts, in pixel columns. */
  const letterAt: number[] = [];
  if (word) {
    const off = mark.length - word.k!.length;
    let x = markW + gap;
    for (const letter of LETTERS) {
      letterAt.push(x);
      const rows = word[letter]!;
      rows.forEach((line, y) =>
        [...line].forEach((px, dx) => (pixels[off + y]![x + dx] = px)),
      );
      x += rows[0]!.length + 2;
    }
  }
  const width = Math.max(...pixels.map((row) => row.length));
  for (const row of pixels) for (let x = 0; x < width; x++) row[x] ??= ".";
  return { pixels, markW, letterAt, width };
}

/** Numbers the mark's nodes (4-connected groups of `#`) in reading order. */
function nodeIds(pixels: string[][], markW: number) {
  const id = pixels.map((row) => row.map(() => -1));
  let next = 0;
  for (let y = 0; y < pixels.length; y++)
    for (let x = 0; x < markW; x++) {
      if (pixels[y]![x] !== "#" || id[y]![x] !== -1) continue;
      const stack = [[x, y]];
      id[y]![x] = next;
      while (stack.length) {
        const [cx, cy] = stack.pop()!;
        for (const [nx, ny] of [
          [cx! + 1, cy!],
          [cx! - 1, cy!],
          [cx!, cy! + 1],
          [cx!, cy! - 1],
        ]) {
          if (nx! < 0 || nx! >= markW || ny! < 0 || ny! >= pixels.length)
            continue;
          if (pixels[ny!]![nx!] === "#" && id[ny!]![nx!] === -1) {
            id[ny!]![nx!] = next;
            stack.push([nx!, ny!]);
          }
        }
      }
      next++;
    }
  return { id, count: next };
}

/** Folds every two pixel rows into one row of ▀ ▄ █ cells. */
function cellsOf(
  mark: string[],
  word: Record<string, string[]> | null,
  gap: number,
): LogoArt {
  const { pixels, markW, letterAt, width } = bitmap(mark, word, gap);
  const { id, count } = nodeIds(pixels, markW);
  if (pixels.length % 2) pixels.push(Array<string>(width).fill("."));
  const cells: LogoCell[] = [];
  const lines: string[] = [];
  for (let y = 0; y < pixels.length; y += 2) {
    let line = "";
    for (let x = 0; x < width; x++) {
      const top = pixels[y]![x]!;
      const bottom = pixels[y + 1]![x]!;
      const on = (px: string) => px !== ".";
      const ch =
        on(top) && on(bottom) ? "█" : on(top) ? "▀" : on(bottom) ? "▄" : " ";
      line += ch;
      if (ch === " ") continue;
      const solid = top === "#" || bottom === "#";
      let kind: CellKind = "wire";
      let part = -1;
      if (solid && x < markW) {
        kind = "node";
        part = Math.max(id[y]![x]!, id[y + 1]![x]!);
      } else if (solid) {
        kind = "word";
        part = count + letterAt.filter((start) => x >= start).length - 1;
      }
      cells.push({ col: x, row: y / 2, ch, kind, part });
    }
    lines.push(line.trimEnd());
  }
  return {
    width,
    height: pixels.length / 2,
    cells,
    parts: count + (word ? LETTERS.length : 0),
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

const cache = new Map<LogoSize, LogoArt>();

/** The logo at a size: the big and regular lockups are pixel art; the compact one sets "klin" beside a small K. */
export function logoArt(size: LogoSize): LogoArt {
  const hit = cache.get(size);
  if (hit) return hit;
  let art: LogoArt;
  if (size === 10) art = cellsOf(MARK_20, WORD_16, 5);
  else if (size === 6) art = cellsOf(MARK_12, WORD_10, 4);
  else if (size === 3) {
    const mark = cellsOf(MARK_6, null, 0);
    const col = mark.width + 3;
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
  cache.set(size, art);
  return art;
}
