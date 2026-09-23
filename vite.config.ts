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
      coverage: {
        provider: 'v8',
        reporter: ['text', 'html'],
        // Scoped on purpose to the critical logic covered by the #56
        // baseline, not the whole repo: a repo-wide percentage is trivially
        // gamed by testing easy UI and leaving this layer bare. Widen this
        // list as coverage is paid down (#59), don't lower the floors.
        include: [
          'src/utils/roomsFirestore.ts',
          'src/utils/QuizDataProvider.ts',
          'src/utils/quizScoring.ts',
        ],
        thresholds: {
          // Per-file floors, keyed by the file they guard. `npm run
          // test:coverage` fails if any of these regresses. It isn't a CI
          // check yet — wiring the suite into CI is #57.
          'src/utils/quizScoring.ts': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
          'src/utils/roomsFirestore.ts': {
            statements: 100,
            branches: 100,
            functions: 100,
            lines: 100,
          },
          // Short of 100 only because of `directImportQuizData`'s `default:`
          // switch arm, which `loadQuizData` normalises away before the call.
          'src/utils/QuizDataProvider.ts': {
            statements: 98,
            branches: 96,
            functions: 100,
            lines: 98,
          },
        },
      },
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
