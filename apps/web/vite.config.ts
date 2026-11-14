import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8082,
    proxy: { '/api': { target: 'http://localhost:3000', changeOrigin: true, rewrite: (path) => path.replace(/^\/api/, '') } },
  },
});
