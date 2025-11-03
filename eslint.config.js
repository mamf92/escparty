// eslint.config.js
import { defineConfig } from 'eslint/config';
import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactRefresh from 'eslint-plugin-react-refresh';
import prettier from 'eslint-config-prettier';

export default defineConfig([
  { ignores: ['dist', 'build', 'coverage', 'node_modules', '.playwright'] },

  js.configs.recommended,
  ...tseslint.configs.recommended,
  react.configs.flat.recommended,

  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  {
    files: ['**/*.{jsx,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      'react/react-in-jsx-scope': 'off',
      'react/jsx-uses-react': 'off',
    },
  },

  {
    files: [
      '**/*.{config,conf}.{js,cjs,mjs,ts,cts,mts}',
      'eslint.config.js',
      'vite.config.{js,ts,mjs,mts}',
      'vitest.config.{js,ts,mjs,mts}',
      'playwright.config.{js,ts,mjs,mts}',
      'tailwind.config.{js,ts}',
      'postcss.config.{js,ts}',
      'scripts/**/*.{js,ts}',
    ],
    languageOptions: {
      globals: globals.node,
    },
  },

  {
    files: ['**/*.{test,spec}.{js,jsx,ts,tsx}'],
    languageOptions: {
      globals: globals.vitest,
    },
  },

  {
    files: ['**/*.e2e.{js,ts}', 'e2e/**/*.{js,ts}'],
    languageOptions: {
      globals: {
        test: true,
        expect: true,
        describe: true,
        beforeAll: true,
        beforeEach: true,
        afterAll: true,
        afterEach: true,
      },
    },
  },

  prettier,
]);
