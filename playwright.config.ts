import { defineConfig } from '@playwright/test';

// Tests load the production build from .output/chrome-mv3, so run `npm run build` first.
export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  // No retries: a flaky extension launch should fail CI, not hide behind a rerun.
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { trace: 'retain-on-failure' },
});
