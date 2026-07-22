import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dev: Vite serves the frontend on 5173 and proxies /api to the bot's dashboard API (default
// :8473; override with VITE_API_TARGET). Prod: pure static build served by nginx; the frontend
// calls the API cross-origin via window.__API_BASE__ (see public/config.js).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': process.env.VITE_API_TARGET || 'http://localhost:8473',
    },
  },
});
