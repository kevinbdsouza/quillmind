// quillmind/vite.config.js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // Optional: Set base directory correctly for Electron builds later
  // base: './', // Use this if you encounter issues with file paths after building
  // Ensure server runs on a specific port
  server: {
    port: 3001, // Or any port you prefer
    strictPort: true, // Prevent Vite from using another port if 3001 is busy
    proxy: {
      // Proxy API requests to the Cloudflare Functions dev server
      '/api': {
        target: 'http://localhost:8788', // Default port for `wrangler dev`
        changeOrigin: true,
      },
    },
  },
  // Optimize build settings for Electron later if needed
  build: {
    outDir: 'dist', // Output directory for production build
  }
});