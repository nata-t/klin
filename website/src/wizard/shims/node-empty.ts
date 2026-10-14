// Node modules the wizard's imports mention but never call in the browser.
const unavailable = (): never => {
  throw new Error("Not available in the browser")
}
export const emitKeypressEvents = () => {}
export const execFileSync = unavailable
export const tmpdir = () => "/tmp"
export const fileURLToPath = (url: string) => url
export default {}
