// Shared ESLint flat config for the whole monorepo (used by the root eslint.config.js).
import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Golden rule (CLAUDE.md §2): vendor SDKs only inside their adapter package.
const vendorSdks = [
  { group: ['@supabase/*'], message: 'Go through @repo/db (CLAUDE.md §2).' },
  {
    group: ['grammy', 'telegraf', 'node-telegram-bot-api', 'web-push'],
    message: 'Go through @repo/notify.',
  },
  {
    group: ['razorpay', 'cashfree-*', '@cashfreepayments/*'],
    message: 'Go through @repo/payments.',
  },
];

// Emoji are banned in product copy (CLAUDE.md §9).
const emoji = '/\\p{Extended_Pictographic}/u';
const noEmoji = [
  { selector: `Literal[value=${emoji}]`, message: 'No emoji. Use a Lucide icon instead.' },
  {
    selector: `TemplateElement[value.raw=${emoji}]`,
    message: 'No emoji. Use a Lucide icon instead.',
  },
  { selector: `JSXText[value=${emoji}]`, message: 'No emoji. Use a Lucide icon instead.' },
];

export default defineConfig([
  globalIgnores([
    '**/node_modules/',
    '**/dist/',
    '**/.turbo/',
    '**/coverage/',
    '**/playwright-report/',
    '**/test-results/',
    '**/routeTree.gen.ts',
    'packages/types/db.ts',
    'supabase/functions/',
  ]),

  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true },
      globals: { ...globals.browser },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': 'error',
      // TanStack Router's documented control flow is `throw redirect(...)`.
      '@typescript-eslint/only-throw-error': [
        'error',
        { allow: [{ from: 'package', package: '@tanstack/router-core', name: 'Redirect' }] },
      ],
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-imports': ['error', { patterns: vendorSdks }],
      'no-restricted-syntax': ['error', ...noEmoji],
    },
  },

  {
    files: ['**/*.js', '**/*.mjs'],
    extends: [tseslint.configs.disableTypeChecked],
    languageOptions: { globals: { ...globals.node } },
  },

  {
    files: ['apps/**/*.{ts,tsx}', 'packages/ui/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended],
  },
  {
    files: ['apps/**/*.tsx'],
    ignores: ['apps/*/src/routes/**'], // TanStack's router plugin handles HMR for route files
    extends: [reactRefresh.configs.vite],
  },

  // Adapter packages may import their own vendor SDKs.
  {
    files: ['packages/db/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: vendorSdks.slice(1) }] },
  },
  {
    files: ['packages/notify/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: [vendorSdks[0], vendorSdks[2]] }] },
  },
  {
    files: ['packages/payments/**'],
    rules: { 'no-restricted-imports': ['error', { patterns: vendorSdks.slice(0, 2) }] },
  },

  // loyalty-core is pure logic shared with Deno edge functions: no React, no Supabase, no POS.
  {
    files: ['packages/loyalty-core/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            ...vendorSdks,
            { group: ['react', 'react-dom', 'react/*'], message: 'loyalty-core has no UI.' },
            {
              group: ['@repo/db', '@repo/ui', '@repo/payments', '@repo/notify', '**/apps/**'],
              message: 'loyalty-core must not depend on POS or app code (CLAUDE.md §3).',
            },
          ],
        },
      ],
    },
  },

  // Tests may assert non-null on fixtures.
  {
    files: ['**/*.test.{ts,tsx}', '**/e2e/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
]);
