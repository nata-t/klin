/**
 * Styles one line of CLI output for the page, the way the terminal shows it:
 * tree branches dark, `+` new files bright, `~` updates muted, ✓ bright,
 * notes faint. Output is HTML.
 */
export function styleLine(raw: string): string {
  const line = raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  // "  klin add   my-app" — the command chip header.
  const header = /^(\s*)(klin \w+)(\s{2,})(.*)$/.exec(line)
  if (header) return `${header[1]}<span class="badge">${header[2]}</span>${header[3]}<span class="note">${header[4]}</span>`
  if (/spotless ✦|Every layer wired|All tidy/.test(line)) return `<span class="shine">${line}</span>`
  if (/^\s{2}[A-Z][a-z]+$/.test(line)) return `<span class="head">${line}</span>`
  return line
    .replace(/^([\s│├└─]+)/, '<span class="tree">$1</span>')
    .replace(/(\+ )([^\s]+)/g, '<span class="add">$1$2</span>')
    .replace(/(~ )([^\s]+)/g, '<span class="mod">$1$2</span>')
    .replace(/(merged with your edits|updated\/merged|needs your eyes|removed|\(\d+\.\ds\))/g, '<span class="note">$1</span>')
    .replace(/(✓|◆)/g, '<span class="ok">$1</span>')
}
