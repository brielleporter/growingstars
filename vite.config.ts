import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    target: 'es2020',
    sourcemap: true
  },
  server: {
    port: 3000,
    open: true,
    hmr: true
  },
  publicDir: false, // Disable public directory since assets are in src
  resolve: {
    alias: {
      '@': '/src'
    }
  }
});