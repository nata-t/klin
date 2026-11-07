# Installable app (PWA)

People can install the web app to their home screen, dock or start menu, and
it opens in its own window. When you deploy a new version, open apps notice
and offer a reload into it instead of quietly running old code.

- **Install:** once the browser says the app can be installed, a banner
  offers it (dismissed, it stays away until the next visit), and the user menu
  gets an **Install app** item. iOS Safari has no install prompt: people use
  Share → Add to Home Screen.
- **Updates:** a new version installs in the background and waits. A toast
  says it's ready, the avatar gets a dot, and **Reload latest version** in the
  user menu (marked _New_) switches to it. That item works without an update
  too: it checks the server first, then reloads.

## How it fits together

| File | What it does |
| --- | --- |
| `apps/web/src/lib/pwa.ts` | Registers the service worker once, catches the install prompt, and holds the state outside React. `initPWA()` runs before the app renders. |
| `apps/web/src/hooks/use-pwa.ts` | `usePWAInstall()` and `usePWAUpdate()` for components. |
| `apps/web/src/components/pwa-prompts.tsx` | The update toast and the install banner. |
| `apps/web/src/components/layout/user-menu.tsx` | **Reload latest version** and **Install app**. |
| `apps/web/public/icon-*.png`, `apple-touch-icon.png` | The app icons. Replace them with your own (keep the sizes; the maskable one keeps its art inside the middle 80%). |
<!-- klin:if vite -->
| `apps/web/vite.config.ts` | `VitePWA()`: the manifest, and a Workbox service worker (`sw.js`) that precaches the build. |
<!-- klin:else -->
| `apps/web/src/app/manifest.ts` | The web app manifest, at `/manifest.webmanifest`. |
| `apps/web/src/app/sw.js/route.ts` | The service worker, rendered once per build. It caches hashed build files and carries the build's time, so every build is a new version. |
<!-- klin:endif -->

The name and description come from `apps/web/src/config/site.ts`.

The service worker only runs in production builds, so `dev` never serves you
stale files. It caches the app's own files and nothing else: API responses
always come from the network, so nobody's data outlives a sign-out.

## Trying it locally

Browsers allow service workers on `localhost` without HTTPS.

<!-- klin:if vite -->
```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web preview
```
<!-- klin:else -->
```bash
pnpm --filter @repo/web build
pnpm --filter @repo/web start
```
<!-- klin:endif -->

Open the app (with the API running), and Chrome's address bar shows an
install button. To see an update: build again, then come back to the tab (or
pick **Reload latest version**). DevTools → Application → Service workers shows
the waiting version.

In production the app must be served over HTTPS.
