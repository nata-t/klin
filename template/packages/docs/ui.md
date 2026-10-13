# UI & theming

The web app's components are [shadcn/ui](https://ui.shadcn.com) on
[Base UI](https://base-ui.com): plain source files you own and edit, styled with
Tailwind CSS v4. The shadcn CLI is already configured, so adding components and
themes is one command.

## Where things live

<!-- klin:if packages-ui -->
Components live in a shared workspace package, `@repo/ui`, so a second app can
use them too:

```
packages/ui/
  components.json          shadcn config for the package (aliases → @repo/ui/*)
  src/components/*.tsx     button, card, dialog, sidebar, … (+ theme-provider)
  src/hooks/               use-mobile
  src/lib/utils.ts         cn()
  src/styles/globals.css   Tailwind, the theme (colors, radius, fonts)
apps/web/
  components.json          shadcn config for the app (ui → @repo/ui/components)
```

Import them by package path:

```tsx
import { Button } from "@repo/ui/components/button"
import { cn } from "@repo/ui/lib/utils"
```

`apps/web/src/main.tsx` imports `@repo/ui/globals.css`, and the stylesheet
points Tailwind at both `packages/ui/src` and `apps/web/src` with `@source`, so
classes used anywhere make it into the CSS.
<!-- klin:else -->
Components live next to the app:

```
apps/web/
  components.json            shadcn config (aliases → @/components/ui, @/lib/utils, …)
  src/components/ui/*.tsx    button, card, dialog, sidebar, …
  src/lib/utils.ts           cn()
  src/styles.css             Tailwind, the theme (colors, radius, fonts)
```

```tsx
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
```

Prefer a shared `packages/ui` workspace (for a second app, say)?
`pnpm klin add packages-ui` moves the components there and rewrites the imports.
<!-- klin:endif -->

## Add components

```bash
pnpm ui:add dialog            # one
pnpm ui:add calendar popover  # several
pnpm ui:add --all             # everything in the registry
```

`pnpm ui:add` runs the shadcn CLI from `apps/web`.
<!-- klin:if packages-ui -->
shadcn reads both `components.json` files: UI primitives go to
`packages/ui/src/components`, their npm dependencies are added to
`packages/ui/package.json`, and any app-level blocks land in `apps/web`.
<!-- klin:else -->
New files go to `apps/web/src/components/ui` and their npm dependencies to
`apps/web/package.json`.
<!-- klin:endif -->
Browse what's available at <https://ui.shadcn.com/docs/components>.

These components use Base UI, so compose with `render` instead of `asChild`:

```tsx
<Button render={<Link to="/settings" />}>Settings</Button>
```

## Theme

<!-- klin:if packages-ui -->
The theme is a block of CSS variables at the top of
`packages/ui/src/styles/globals.css`:
<!-- klin:else -->
The theme is a block of CSS variables at the top of `apps/web/src/styles.css`:
<!-- klin:endif -->

```css
:root {
  --brand: …;            /* buttons, focus rings, the active sidebar item */
  --brand-foreground: …; /* text on --brand */
  --chart-1: … --chart-5: …;
  --sidebar-primary: …;
}
.dark { /* the same, for dark mode */ }
```

Everything "primary" derives from `--brand`, so changing those few lines
re-themes the app. The colors come from shadcn's themes (neutral, amber, blue,
cyan, emerald, fuchsia, green, indigo, lime, orange, pink, purple, red, rose,
sky, teal, violet, yellow) — pick another at <https://ui.shadcn.com/themes>
and copy its `primary` / `chart-*` / `sidebar-primary` values into the block.

Themes from a registry (shadcn's own, or e.g. tweakcn) install like components:

```bash
pnpm ui:add https://tweakcn.com/r/themes/<theme>.json
```

That rewrites the theme variables in the stylesheet; keep `--primary:
var(--brand)` (or point `--primary` at the new value) so the rest of the app
follows.

Dark mode is class-based (`.dark` on `<html>`), driven by `ThemeProvider` — the
toggle lives in the header, and pressing <kbd>d</kbd> anywhere switches it.
