import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  // Both are generated output: `dist` from a build, `coverage` from
  // `npm run test:coverage` (its HTML report ships its own bundled JS).
  { ignores: ['dist', 'coverage'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      // The codebase already marks deliberately unused bindings with a leading
      // underscore, so make the linter agree with the convention.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' },
      ],
      'react-refresh/only-export-components': [
        'warn',
        { allowConstantExport: true },
      ],
    },
  },
  {
    // The React Compiler rules react-hooks 7 added found 18 problems in
    // these files, written before the rules: warnings here until #160 fixes
    // them, errors everywhere else so no new file adds one.
    files: [
      'src/components/Quiz.tsx',
      'src/fabric-ui/CameraRig.tsx',
      'src/fabric-ui/FabricSurface.tsx',
      'src/hooks/useOwnBallot.ts',
      'src/hooks/usePartyData.ts',
      'src/pages/Home.tsx',
      'src/pages/HostObserverView.tsx',
      'src/pages/Scoreboard.tsx',
    ],
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
    },
  },
  {
    // Test files and the shared test helpers never ship in the app bundle,
    // so Fast Refresh's "components only" rule doesn't apply to them —
    // test-utils.tsx exports a provider wrapper alongside plain helpers on
    // purpose.
    files: ['src/test/**/*.{ts,tsx}', '**/*.{test,spec}.{ts,tsx}'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },
)
