/**
 * ESLint (flat config) for the tooling layer only — tools/ and tests/ are
 * plain Node ESM scripts. Site/component code is covered by `npm run typecheck`.
 */
import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    files: ['tools/**/*.mjs', 'tests/**/*.mjs', 'eslint.config.mjs'],
    ...js.configs.recommended,
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: globals.node,
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['error', {argsIgnorePattern: '^_', caughtErrors: 'none'}],
    },
  },
  {
    // Flow files run in both Node (import-time) and the browser (page.evaluate callbacks).
    files: ['tools/flows/**/*.mjs'],
    languageOptions: {
      globals: {...globals.node, ...globals.browser},
    },
  },
  {
    ignores: ['node_modules/', 'build/', '.docusaurus/'],
  },
];
