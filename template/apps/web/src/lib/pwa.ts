/**
 * The installable app (PWA): the install prompt and service worker updates,
 * kept outside React so that
 *  - the service worker is registered exactly once (StrictMode's double effects
 *    and several components using the hooks would otherwise race), and
 *  - `beforeinstallprompt`, which can fire before React mounts, is never missed.
 *
 * `initPWA()` runs once before the app renders; components read the state with
 * the hooks in hooks/use-pwa.ts. See packages/docs/pwa.md.
 */

interface BeforeInstallPromptEvent extends Event {
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>
  prompt(): Promise<void>
}

export interface PWAState {
  /** A new version is installed and waiting to take over. */
  needsUpdate: boolean
  /** The browser has offered to install the app. */
  isInstallable: boolean
  /** Running as the installed app (standalone window). */
  isInstalled: boolean
}

/** How often a long-lived tab asks the server for a new version. */
const UPDATE_CHECK_INTERVAL_MS = 30 * 60 * 1000
/** Reload anyway if the new worker hasn't taken over by then. */
const ACTIVATION_TIMEOUT_MS = 8000

let state: PWAState = { needsUpdate: false, isInstallable: false, isInstalled: false }
const listeners = new Set<() => void>()

let registration: ServiceWorkerRegistration | undefined
let deferredPrompt: BeforeInstallPromptEvent | null = null
let initialized = false

function setState(patch: Partial<PWAState>) {
  state = { ...state, ...patch }
  listeners.forEach((listener) => listener())
}

export function subscribePWA(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current state; on the server it stays the initial one (nothing to install or update). */
export const getPWAState = () => state

function detectInstalled() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/** Watches a worker that is installing: once it's installed next to the one in charge, a reload brings it in. */
function watch(worker: ServiceWorker) {
  worker.addEventListener("statechange", () => {
    if (worker.state === "installed" && navigator.serviceWorker.controller) setState({ needsUpdate: true })
  })
}

async function registerServiceWorker() {
  // updateViaCache "none": update checks always ask the server, never the HTTP cache.
  const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" })
  registration = reg
  if (reg.waiting && navigator.serviceWorker.controller) setState({ needsUpdate: true })
  if (reg.installing) watch(reg.installing)
  reg.addEventListener("updatefound", () => {
    if (reg.installing) watch(reg.installing)
  })

  // The browser only checks for a new worker on navigation; a tab can stay open
  // for days, so check every so often and whenever the tab comes back into view.
  const check = () => {
    if (navigator.onLine) reg.update().catch(() => {})
  }
  setInterval(check, UPDATE_CHECK_INTERVAL_MS)
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") check()
  })
}

export function initPWA() {
  if (initialized || typeof window === "undefined") return
  initialized = true

  setState({ isInstalled: detectInstalled() })
  window.matchMedia("(display-mode: standalone)").addEventListener("change", (e) => setState({ isInstalled: e.matches }))

  window.addEventListener("beforeinstallprompt", (e) => {
    // Keep the browser's own mini-infobar away; the app offers its own button.
    e.preventDefault()
    deferredPrompt = e as BeforeInstallPromptEvent
    setState({ isInstallable: true })
  })
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null
    setState({ isInstallable: false, isInstalled: true })
  })

  // The service worker runs in production builds only, so dev never serves stale files. (The build
  // mode, not PROD: PROD follows NODE_ENV, which the root .env sets to development.)
  if (!("serviceWorker" in navigator) || import.meta.env.MODE !== "production") return // klin:only vite
  //? if (!("serviceWorker" in navigator) || process.env.NODE_ENV !== "production") return // klin:only next
  registerServiceWorker().catch((error: unknown) => console.error("Service worker registration failed", error))
}

/** Opens the browser's install dialog. Resolves to what the person picked, or null if there's nothing to install. */
export async function promptInstall(): Promise<"accepted" | "dismissed" | null> {
  if (!deferredPrompt) return null
  const prompt = deferredPrompt
  deferredPrompt = null
  await prompt.prompt()
  const { outcome } = await prompt.userChoice
  setState({ isInstallable: false })
  return outcome
}

function installed(worker: ServiceWorker): Promise<void> {
  return new Promise((resolve) => {
    if (worker.state !== "installing") return resolve()
    worker.addEventListener("statechange", () => {
      if (worker.state !== "installing") resolve()
    })
  })
}

/** Lets the waiting worker take over, then reloads, so the reload is served by the new version. */
function activateAndReload(waiting: ServiceWorker) {
  let reloaded = false
  const reload = () => {
    if (reloaded) return
    reloaded = true
    window.location.reload()
  }
  navigator.serviceWorker.addEventListener("controllerchange", reload)
  setTimeout(reload, ACTIVATION_TIMEOUT_MS)
  waiting.postMessage({ type: "SKIP_WAITING" })
}

/**
 * "Get the latest version": asks the server for a new version, switches to it if
 * there is one, and reloads. Without a service worker (or when already up to
 * date) it's a plain reload, which refetches everything too.
 */
export async function reloadToLatest(): Promise<void> {
  const reg = registration
  if (!reg) return window.location.reload()

  try {
    await reg.update()
  } catch {
    // Offline or the server is unreachable: use what's already here.
  }
  if (reg.installing) await installed(reg.installing)
  if (reg.waiting) return activateAndReload(reg.waiting)
  window.location.reload()
}
