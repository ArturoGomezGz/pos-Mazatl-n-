import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // El build de demo (modo "mock") se publica como página de proyecto en
  // GitHub Pages, servido bajo /<repo>/ en vez de la raíz del dominio.
  // El build real del restaurante (modo por defecto) sigue en la raíz.
  base: mode === 'mock' ? '/pos-Mazatl-n-/' : '/',
  server: {
    port: 5173,
    // Las tablets del restaurante entran por la IP del servidor, no por localhost.
    host: true,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
}));
