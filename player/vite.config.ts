import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, proxy /api/* to the production backend through the public proxy
// so a developer can run `npm run dev` and see real demos without spinning
// up the whole stack locally.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://demo.deltakinetics.io',
        changeOrigin: true,
        secure: true,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'es2020',
  },
});
