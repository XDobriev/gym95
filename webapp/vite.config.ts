import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vercel root directory = webapp/. Фронт собирается Vite в dist/,
// serverless-функции лежат в webapp/api/ и деплоятся Vercel отдельно.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
});
