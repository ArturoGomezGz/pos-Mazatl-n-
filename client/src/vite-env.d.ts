/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** '1' cuando el cliente se compila para el modo demo (GitHub Pages),
   *  sin servidor real detrás: usa la API simulada en el navegador. */
  readonly VITE_MOCK?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
