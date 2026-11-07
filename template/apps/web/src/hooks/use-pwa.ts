import { useState, useSyncExternalStore } from "react"
import { getPWAState, promptInstall, reloadToLatest, subscribePWA } from "@/lib/pwa"

/** The installable app's state (lib/pwa.ts), re-rendering when it changes. */
export function usePWAState() {
  return useSyncExternalStore(subscribePWA, getPWAState, getPWAState)
}

/** Installing the app. A dismissed banner stays away until the next page load. */
export function usePWAInstall() {
  const { isInstallable, isInstalled } = usePWAState()
  const [isDismissed, setIsDismissed] = useState(false)
  return {
    /** The browser offered to install the app, and it isn't installed yet. */
    canInstall: isInstallable && !isInstalled,
    isInstalled,
    promptInstall,
    isDismissed,
    dismiss: () => setIsDismissed(true),
  }
}

/** Updating the app: whether a new version is waiting, and the reload that switches to it. */
export function usePWAUpdate() {
  const { needsUpdate } = usePWAState()
  return { needsUpdate, reloadToLatest }
}
