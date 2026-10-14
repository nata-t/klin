/**
 * A tiny grayscale highlighter for the landing page's code panes: keywords
 * bright, strings muted, comments faint. Hue stays out of it, as in the CLI.
 */

const KEYWORDS = /\b(import|from|const|export|type|typeof|class|extends|return|async|await|new|default|interface)\b/g

export function highlight(source: string, json = false): string {
  const escaped = source.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
  if (/^\s*(\/\/|\/\*\*|\*)/.test(source)) return `<span class="c">${escaped}</span>`
  // Split out strings first so keywords inside them stay untouched.
  return escaped
    .split(/("(?:[^"\\]|\\.)*")/g)
    .map((part, i) => {
      if (i % 2 === 1) return json ? `<span class="s">${part}</span>` : `<span class="s">${part}</span>`
      if (json) return part.replace(/([{}[\],:])/g, '<span class="p">$1</span>')
      return part.replace(KEYWORDS, '<span class="k">$1</span>')
    })
    .join("")
}
