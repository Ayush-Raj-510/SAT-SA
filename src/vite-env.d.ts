/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Origin of the FastAPI backend for static-hosting deployments (no trailing slash). */
  readonly VITE_API_ORIGIN?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
