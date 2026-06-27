import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/dashboard/',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8765',
    },
  },
  // Pre-bundle heavy deps at startup so first browser load is fast.
  optimizeDeps: {
    include: [
      'react', 'react-dom', 'react-dom/client',
      '@tanstack/react-query',
      'lucide-react',
    ],
  },
  build: {
    outDir: '../public/dashboard',
    emptyOutDir: true,
  },
});
