// Nothing exists on the visitor's disk as far as the wizard can tell: every name is free.
export const existsSync = () => false
export const readFileSync = (): never => {
  throw new Error("readFileSync isn't available in the browser")
}
export const readdirSync = () => [] as string[]
export const statSync = (): never => {
  throw new Error("statSync isn't available in the browser")
}
export const mkdtempSync = () => "/tmp/klin"
export default { existsSync, readFileSync, readdirSync, statSync, mkdtempSync }
