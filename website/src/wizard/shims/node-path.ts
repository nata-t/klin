// The slice of node:path the wizard uses, for POSIX paths.
const normalize = (path: string) => {
  const absolute = path.startsWith("/")
  const parts: string[] = []
  for (const part of path.split("/")) {
    if (!part || part === ".") continue
    if (part === "..") parts.pop()
    else parts.push(part)
  }
  return (absolute ? "/" : "") + parts.join("/")
}

export const sep = "/"
export const join = (...parts: string[]) => normalize(parts.filter(Boolean).join("/")) || "."
export const resolve = (...parts: string[]) => {
  let path = ""
  for (const part of parts) path = part.startsWith("/") ? part : `${path}/${part}`
  return normalize(path.startsWith("/") ? path : `/home/you/code/${path}`) || "/"
}
export const basename = (path: string) => normalize(path).split("/").filter(Boolean).pop() ?? ""
export const dirname = (path: string) => normalize(path).split("/").slice(0, -1).join("/") || "/"
export const relative = (from: string, to: string) => {
  const a = resolve(from).split("/").filter(Boolean)
  const b = resolve(to).split("/").filter(Boolean)
  let i = 0
  while (i < a.length && a[i] === b[i]) i++
  return [...a.slice(i).map(() => ".."), ...b.slice(i)].join("/")
}
export default { sep, join, resolve, basename, dirname, relative }
