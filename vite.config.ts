import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite serves the frontend on 5173 and proxies /api to the Express backend on 8473.
// Prod: the frontend is built to /dist and served by Express directly (no proxy).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8473',
    },
  },
});
