import { defineConfig, type Options } from "tsup"

/**
 * The API is bundled with tsup (esbuild + SWC for decorator metadata).
 *
 * Workspace packages (@repo/*) ship TypeScript source, so they're compiled
 * into the bundle. Everything from npm stays external and is loaded from
 * node_modules at runtime — which is why apps/api/package.json lists the
 * runtime dependencies of the @repo packages it uses.
 *
 * `pnpm dev` rebuilds on any change in src/ or packages/ and restarts the server.
 */
export default defineConfig((options) => ({
  entry: ["src/main.ts"],
  format: "esm",
  platform: "node",
  target: "node22",
  outDir: "dist",
  sourcemap: true,
  clean: true,
  // React Email templates (packages/email) use the automatic JSX runtime.
  // (tsup fills in `logger` itself; its type just doesn't say so.)
  swc: { jsc: { transform: { react: { runtime: "automatic" } } } } as unknown as Options["swc"],
  noExternal: [/^@repo\//],
  external: [/^(?!@repo\/)[a-z@][^:]*$/],
  watch: options.watch ? ["src", "../../packages/*/src"] : false,
  onSuccess: options.watch ? "node --enable-source-maps dist/main.js" : undefined,
}))
