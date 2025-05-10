import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const base = mode === 'production' ? '/escparty/' : '/';

  return {
    base,
    plugins: [react()],
    server: {
      // Configure server for better development experience
      host: true, // Listen on all local IPs
      port: 5173,
      open: true, // Auto-open browser
    },
    build: {
      // Output directory - this should match your GitHub Pages settings
      outDir: 'dist',
      rollupOptions: {
        output: {
          // Get better cache handling with content hashes
          entryFileNames: 'assets/[name]-[hash].js',
          chunkFileNames: 'assets/[name]-[hash].js',
          assetFileNames: 'assets/[name]-[hash].[ext]'
        }
      }
    }
  };
});
