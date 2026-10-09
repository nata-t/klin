/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API origin when it's deployed separately. Empty = same origin via /api proxy. */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
