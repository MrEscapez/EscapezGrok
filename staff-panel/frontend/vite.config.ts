import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

/**
 * Dev proxy: /api → Nest backend so cookies stay same-origin (localhost:5173).
 * Frontend VITE_API_URL=/api/v1 uses this path.
 * Alternatief: VITE_API_URL=http://localhost:3000/api/v1 + CORS credentials.
 */
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:3000',
        changeOrigin: true,
      },
    },
  },
});
