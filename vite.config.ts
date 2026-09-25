import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      // In dev the backend is optional (analytics run in the browser). When
      // it is running, proxy /api so the AI analyst endpoints resolve; SSE
      // passes through unbuffered so chat tokens arrive incrementally.
      // The origin is overridable so the dev port never collides with other
      // local services (the Docker deployment uses 8001; see README).
      proxy: {
        '/api': {
          target: process.env.SAT_SA_BACKEND_ORIGIN || 'http://127.0.0.1:8001',
          changeOrigin: true,
          configure: (proxy) => {
            proxy.on('proxyRes', (proxyRes) => {
              proxyRes.headers['x-accel-buffering'] = 'no';
            });
          },
        },
      },
    },
  };
});
