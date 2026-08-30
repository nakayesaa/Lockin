import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  root: resolve('src/renderer'),
  define: {
    __LOCKIN_UI_PREVIEW__: 'true',
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared'),
    },
  },
  server: {
    host: '127.0.0.1',
    port: 5173,
  },
});
