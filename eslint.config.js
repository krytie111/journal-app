const { defineConfig, globalIgnores } = require('eslint/config');

const globals = require('globals');
const js = require('@eslint/js');

const { FlatCompat } = require('@eslint/eslintrc');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

module.exports = defineConfig([
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.browser,
      },

      ecmaVersion: 2021,
      sourceType: 'module',
      parserOptions: {},
    },

    extends: compat.extends('eslint:recommended', 'plugin:prettier/recommended'),

    rules: {
      'no-console': 'warn',
    },
  },
  globalIgnores(['**/node_modules', '**/dist', '**/.build', '**/coverage', '**/.vscode']),
]);
