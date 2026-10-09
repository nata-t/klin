import { pc, unicode } from "./theme"

export type ChangeKind = "create" | "update" | "merge" | "conflict" | "delete" | "keep" | "skip"

const MARKS: Record<ChangeKind, (s: string) => string> = {
  create: (s) => pc.green(s),
  update: (s) => pc.cyan(s),
  merge: (s) => pc.cyan(s),
  conflict: (s) => pc.yellow(s),
  delete: (s) => pc.red(s),
  keep: (s) => pc.dim(s),
  skip: (s) => pc.dim(s),
}

const SIGNS: Record<ChangeKind, string> = {
  create: "+",
  update: "~",
  merge: "~",
  conflict: "!",
  delete: "-",
  keep: "=",
  skip: "·",
}

interface Node {
  children: Map<string, Node>
  kind?: ChangeKind
  note?: string
}

/**
 * Renders file paths as a tree with change markers:
 *
 *   apps/
 *   ├─ api/src/modules/projects/
 *   │  ├─ + projects.controller.ts
 */
export function fileTree(entries: Array<{ path: string; kind: ChangeKind; note?: string }>, indent = "  ") {
  const root: Node = { children: new Map() }
  for (const entry of [...entries].sort((a, b) => a.path.localeCompare(b.path))) {
    let node = root
    for (const part of entry.path.split("/")) {
      if (!node.children.has(part)) node.children.set(part, { children: new Map() })
      node = node.children.get(part)!
    }
    node.kind = entry.kind
    node.note = entry.note
  }

  // Collapse single-child directory chains: apps/ → api/ → src/ becomes apps/api/src/
  const collapse = (name: string, node: Node): [string, Node] => {
    let label = name
    let current = node
    while (!current.kind && current.children.size === 1) {
      const [childName, child] = [...current.children][0]!
      if (child.kind) break
      label += `/${childName}`
      current = child
    }
    return [label, current]
  }

  const branch = unicode ? { mid: "├─ ", last: "└─ ", pipe: "│  ", space: "   " } : { mid: "|- ", last: "`- ", pipe: "|  ", space: "   " }
  const lines: string[] = []
  const walk = (node: Node, prefix: string) => {
    const children = [...node.children].map(([name, child]) => collapse(name, child))
    children.forEach(([name, child], index) => {
      const last = index === children.length - 1
      const connector = pc.dim(prefix + (last ? branch.last : branch.mid))
      if (child.kind) {
        const mark = MARKS[child.kind]
        lines.push(`${indent}${connector}${mark(SIGNS[child.kind])} ${mark(name)}${child.note ? pc.dim(`  ${child.note}`) : ""}`)
      } else {
        lines.push(`${indent}${connector}${pc.dim(name + "/")}`)
        walk(child, prefix + (last ? branch.space : branch.pipe))
      }
    })
  }
  walk(root, "")
  return lines.join("\n")
}
