import { defineConfig } from '@playwright/test';

// Chrome Web Store images (`npm run store-assets`), kept out of the e2e suite and CI. Loads the
// production build, so run `npm run build` first.
export default defineConfig({
  testDir: '.',
  timeout: 120_000,
  retries: 0,
  workers: 1,
  reporter: 'list',
});
