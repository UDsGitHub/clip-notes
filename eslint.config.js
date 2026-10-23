import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

// Local-first: the extension must never talk to the network (README "Privacy").
const NETWORK_APIS = ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource'];
const NETWORK_MESSAGE = 'No network calls: Clip Notes is local-only.';
const networkBan = {
  'no-restricted-globals': [
    'error',
    ...NETWORK_APIS.map((name) => ({ name, message: NETWORK_MESSAGE })),
  ],
  'no-restricted-properties': [
    'error',
    ...['window', 'self', 'globalThis'].flatMap((object) =>
      NETWORK_APIS.map((property) => ({ object, property, message: NETWORK_MESSAGE })),
    ),
    { object: 'navigator', property: 'sendBeacon', message: NETWORK_MESSAGE },
  ],
};

export default tseslint.config(
  {
    ignores: [
      '.output/',
      '.wxt/',
      'node_modules/',
      'coverage/',
      'playwright-report/',
      'test-results/',
      'clip-notes-zipped/',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx,js,jsx,mjs}'],
    ignores: ['e2e/**'],
    languageOptions: { globals: { ...globals.browser } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...networkBan,
    },
  },
  {
    files: ['e2e/**', '*.config.{ts,js}'],
    languageOptions: { globals: { ...globals.node } },
    rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' },
  },
);
