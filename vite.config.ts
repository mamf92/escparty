/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const isVercel = Boolean(process.env.VERCEL || process.env.VERCEL_ENV);
  const base = isVercel ? '/' : mode === 'production' ? '/escparty/' : '/';

  return {
    base,
    plugins: [react()],
    server: {
      // Configure server for better development experience
      host: true, // Listen on all local IPs
      port: 5173,
      open: false, // Auto-open browser
    },
    test: {
      // Unit/component tests. See docs/agent/testing.md.
      environment: 'jsdom',
      // Off on purpose: tests import describe/it/expect from 'vitest', so
      // nothing depends on ambient globals. src/test/setup.ts wires the
      // Testing Library cleanup that `globals: true` would otherwise do.
      globals: false,
      setupFiles: ['./src/test/setup.ts'],
      // styled-components generates its CSS at runtime, but plain .css
      // imports (App.css, scoreboard-calm.css) still have to resolve.
      css: true,
      include: ['src/**/*.{test,spec}.{ts,tsx}'],
      restoreMocks: true,
    },
    build: {
      // Output directory - Vercel picks this up as the build output
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
