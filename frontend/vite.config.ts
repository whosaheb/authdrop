import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The SPA, the REST API (/api) and the OIDC provider (/oauth) share ONE origin.
// In dev, Vite proxies the last two to the NestJS backend; in production a reverse proxy does the same.
const BACKEND = process.env.BACKEND_URL ?? 'http://localhost:3000';

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: BACKEND, changeOrigin: false },
      '/oauth': { target: BACKEND, changeOrigin: false },
    },
  },
  preview: { port: 5173, strictPort: true },
  build: { sourcemap: mode !== 'production', target: 'es2023' },
}));
