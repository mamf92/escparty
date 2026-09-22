import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist'] },
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
