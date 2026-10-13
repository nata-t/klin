/** "KLIN" in ANSI Shadow — the banner and the generated app's hero use it. */
export const LOGO = [
  "██╗  ██╗██╗     ██╗███╗   ██╗",
  "██║ ██╔╝██║     ██║████╗  ██║",
  "█████╔╝ ██║     ██║██╔██╗ ██║",
  "██╔═██╗ ██║     ██║██║╚██╗██║",
  "██║  ██╗███████╗██║██║ ╚████║",
  "╚═╝  ╚═╝╚══════╝╚═╝╚═╝  ╚═══╝",
]

/**
 * The same letters at half the height, for the full-screen UI's header: every
 * two rows of solid blocks fold into one row of ▀ ▄ █.
 *
 *   ██  ▄█▀ ██      ██ ███▄   ██
 *   ██▀▀█▄  ██      ██ ██ ▀█▄ ██
 *   ▀▀   ▀▀ ▀▀▀▀▀▀▀ ▀▀ ▀▀   ▀▀▀▀
 */
export const MINI_LOGO: string[] = (() => {
  const solid = (row: number, col: number) => LOGO[row]?.[col] === "█"
  const rows: string[] = []
  for (let row = 0; row < LOGO.length; row += 2) {
    let line = ""
    for (let col = 0; col < LOGO[0]!.length; col++) {
      const top = solid(row, col)
      const bottom = solid(row + 1, col)
      line += top && bottom ? "█" : top ? "▀" : bottom ? "▄" : " "
    }
    rows.push(line.trimEnd())
  }
  return rows
})()

export const MINI_LOGO_WIDTH = Math.max(...MINI_LOGO.map((line) => line.length))
